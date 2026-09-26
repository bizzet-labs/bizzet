import {
  type Account,
  type Address,
  type Chain,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  keccak256,
  maxUint160,
  type PublicClient,
  parseAbi,
  parseAbiParameters,
  type Transport,
  toHex,
  type WalletClient,
} from 'viem'
import { sepolia } from './addresses/sepolia.ts'

// Uniswap が Sepolia に配置した v4 のコントラクト。出典は Uniswap の公式ドキュメントの配置一覧で、
// どれも Sepolia 上にコードがあることを確かめた（2026-09-27 確認）
export const uniswapV4 = {
  poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
  universalRouter: '0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b',
  positionManager: '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4',
  stateView: '0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C',
  quoter: '0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
} as const satisfies Record<string, Address>

export type PoolKey = {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

// JPYC/USDC のプール。Sepolia で 1 USDC ≒ 150 JPYC で初期化済みの、手数料 0.01%・フックなしのもの
export const JPYC_USDC_POOL_KEY: PoolKey = {
  currency0: sepolia.tokens.usdc,
  currency1: sepolia.tokens.jpyc,
  fee: 100,
  tickSpacing: 1,
  hooks: '0x0000000000000000000000000000000000000000',
}

// Universal Router の Commands.sol の V4_SWAP
export const V4_SWAP_COMMAND = 0x10

// v4-periphery の Actions.sol の値（使うものだけ）
export const v4Actions = {
  MINT_POSITION: 0x02,
  SWAP_EXACT_OUT_SINGLE: 0x08,
  SETTLE_ALL: 0x0c,
  SETTLE_PAIR: 0x0d,
  TAKE: 0x0e,
} as const

// TickMath の範囲。tickSpacing が 1 のため、全範囲の tick はこの値のまま使える
export const MIN_TICK = -887272
export const MAX_TICK = 887272
const MIN_SQRT_PRICE = 4295128739n
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n
const Q96 = 2n ** 96n

const poolKeyComponents = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
] as const

export const v4QuoterAbi = [
  {
    type: 'function',
    name: 'quoteExactOutputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'poolKey', type: 'tuple', components: poolKeyComponents },
          { name: 'zeroForOne', type: 'bool' },
          { name: 'exactAmount', type: 'uint128' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

export const universalRouterAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
])

export const positionManagerAbi = parseAbi([
  'function modifyLiquidities(bytes unlockData, uint256 deadline) payable',
  'function nextTokenId() view returns (uint256)',
])

export const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)',
])

export const permit2Abi = parseAbi([
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
  'function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
])

export const erc20ApproveAbi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

// PoolManager がプールを識別する ID（PoolKey を abi.encode した keccak256）
export function poolIdOf(key: PoolKey = JPYC_USDC_POOL_KEY): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, uint24, int24, address'),
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  )
}

// tokenIn が currency0 なら、価格を下げる向き（zeroForOne）の交換になる
function zeroForOneOf(tokenIn: Address, tokenOut: Address): boolean {
  const c0 = JPYC_USDC_POOL_KEY.currency0.toLowerCase()
  const c1 = JPYC_USDC_POOL_KEY.currency1.toLowerCase()
  const i = tokenIn.toLowerCase()
  const o = tokenOut.toLowerCase()
  if (i === c0 && o === c1) return true
  if (i === c1 && o === c0) return false
  throw new Error('JPYC/USDC のプールで交換できない通貨の組み合わせです')
}

function poolKeyTuple(key: PoolKey) {
  return {
    currency0: key.currency0,
    currency1: key.currency1,
    fee: key.fee,
    tickSpacing: key.tickSpacing,
    hooks: key.hooks,
  }
}

export type ExactOutputParams = {
  tokenIn: Address
  tokenOut: Address
  // 受取先が受け取る量（tokenOut の最小単位）
  amountOut: bigint
}

// 受取先に amountOut を届けるのに客が払う tokenIn の量を、V4Quoter で見積もる。
// V4Quoter は内部で revert させて結果を取り出すが、外からは戻り値として返るため eth_call で読む
export async function quoteExactOutput(
  client: PublicClient,
  params: ExactOutputParams,
): Promise<bigint> {
  const { result } = await client.simulateContract({
    address: uniswapV4.quoter,
    abi: v4QuoterAbi,
    functionName: 'quoteExactOutputSingle',
    args: [
      {
        poolKey: poolKeyTuple(JPYC_USDC_POOL_KEY),
        zeroForOne: zeroForOneOf(params.tokenIn, params.tokenOut),
        exactAmount: params.amountOut,
        hookData: '0x',
      },
    ],
  })
  return result[0]
}

export type SwapToRecipientParams = ExactOutputParams & {
  // 客が払ってよい tokenIn の上限（見積もりに許容の幅を足した値）
  amountInMaximum: bigint
  // 交換した tokenOut を受け取るアドレス（店舗の Safe）
  recipient: Address
  // Universal Router の execute の期限（unix 秒）
  deadline: bigint
}

// Sepolia の Universal Router が組み込む V4Router の ExactOutputSingleParams。
// v4-periphery の main には minHopPriceX36 が加わっているが、Sepolia の配置は追加前の形で、
// fork 上の交換でこの形が通ることを確かめた
const exactOutputSingleParams = parseAbiParameters(
  '((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountOut, uint128 amountInMaximum, bytes hookData)',
)

// Universal Router の execute(commands, inputs, deadline) の呼び出しを組み立てる。
// 1回の取引で、客の tokenIn を Permit2 経由で払い、交換した tokenOut を recipient に直接届ける
export function encodeSwapExactOutputToRecipient(
  params: SwapToRecipientParams,
): {
  to: Address
  data: Hex
} {
  const actions = concatHex([
    toHex(v4Actions.SWAP_EXACT_OUT_SINGLE, { size: 1 }),
    toHex(v4Actions.SETTLE_ALL, { size: 1 }),
    toHex(v4Actions.TAKE, { size: 1 }),
  ])
  const swap = encodeAbiParameters(exactOutputSingleParams, [
    {
      poolKey: poolKeyTuple(JPYC_USDC_POOL_KEY),
      zeroForOne: zeroForOneOf(params.tokenIn, params.tokenOut),
      amountOut: params.amountOut,
      amountInMaximum: params.amountInMaximum,
      hookData: '0x',
    },
  ])
  // SETTLE_ALL は msg.sender（客）から Permit2 経由で、上限つきで払う
  const settle = encodeAbiParameters(parseAbiParameters('address, uint256'), [
    params.tokenIn,
    params.amountInMaximum,
  ])
  // TAKE は受取先を指定して、ちょうど amountOut を PoolManager から送る
  const take = encodeAbiParameters(
    parseAbiParameters('address, address, uint256'),
    [params.tokenOut, params.recipient, params.amountOut],
  )
  const v4SwapInput = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [actions, [swap, settle, take]],
  )
  return {
    to: uniswapV4.universalRouter,
    data: encodeFunctionData({
      abi: universalRouterAbi,
      functionName: 'execute',
      args: [
        toHex(V4_SWAP_COMMAND, { size: 1 }),
        [v4SwapInput],
        params.deadline,
      ],
    }),
  }
}

// Permit2 の approve(token, spender, amount, expiration) を、任意の spender に向けて組み立てる
export function encodePermit2ApproveFor(params: {
  token: Address
  spender: Address
  amount: bigint
  expiration: number
}): { to: Address; data: Hex } {
  return {
    to: uniswapV4.permit2,
    data: encodeFunctionData({
      abi: permit2Abi,
      functionName: 'approve',
      args: [params.token, params.spender, params.amount, params.expiration],
    }),
  }
}

// 客が Universal Router に tokenIn を使わせるための、Permit2 の approve(token, spender, amount, expiration)
export function encodePermit2Approve(params: {
  token: Address
  amount: bigint
  expiration: number
}): { to: Address; data: Hex } {
  return encodePermit2ApproveFor({
    ...params,
    spender: uniswapV4.universalRouter,
  })
}

// Permit2 に通貨を引き出させるための、ERC-20 の approve(Permit2, amount)
export function encodeErc20ApproveToPermit2(params: {
  token: Address
  amount: bigint
}): { to: Address; data: Hex } {
  return {
    to: params.token,
    data: encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: 'approve',
      args: [uniswapV4.permit2, params.amount],
    }),
  }
}

// Permit2 が Universal Router に許している量と期限を読む
export async function readPermit2Allowance(
  client: PublicClient,
  params: { owner: Address; token: Address },
): Promise<{ amount: bigint; expiration: number }> {
  const [amount, expiration] = await client.readContract({
    address: uniswapV4.permit2,
    abi: permit2Abi,
    functionName: 'allowance',
    args: [params.owner, params.token, uniswapV4.universalRouter],
  })
  return { amount, expiration }
}

// ---- 流動性の追加 ----

export type PoolState = {
  sqrtPriceX96: bigint
  tick: number
  liquidity: bigint
}

// StateView で、JPYC/USDC のプールの現在の価格と有効な流動性を読む
export async function readPoolState(client: PublicClient): Promise<PoolState> {
  const poolId = poolIdOf(JPYC_USDC_POOL_KEY)
  const [[sqrtPriceX96, tick], liquidity] = await Promise.all([
    client.readContract({
      address: uniswapV4.stateView,
      abi: stateViewAbi,
      functionName: 'getSlot0',
      args: [poolId],
    }),
    client.readContract({
      address: uniswapV4.stateView,
      abi: stateViewAbi,
      functionName: 'getLiquidity',
      args: [poolId],
    }),
  ])
  return { sqrtPriceX96, tick, liquidity }
}

// 全範囲の位置に、currency0・currency1 をそれぞれ上限まで入れたときの流動性。
// LiquidityAmounts.getLiquidityForAmounts と同じ式で、2つのうち小さい方を採る
export function fullRangeLiquidityForAmounts(
  sqrtPriceX96: bigint,
  amount0: bigint,
  amount1: bigint,
): bigint {
  const sqrtA = MIN_SQRT_PRICE
  const sqrtB = MAX_SQRT_PRICE
  const l0 = (amount0 * ((sqrtPriceX96 * sqrtB) / Q96)) / (sqrtB - sqrtPriceX96)
  const l1 = (amount1 * Q96) / (sqrtPriceX96 - sqrtA)
  return l0 < l1 ? l0 : l1
}

// PositionManager の modifyLiquidities で、全範囲の位置を作る（MINT_POSITION と SETTLE_PAIR）。
// 支払いは msg.sender から Permit2 経由で行われる
export function encodeMintFullRange(params: {
  liquidity: bigint
  amount0Max: bigint
  amount1Max: bigint
  owner: Address
  deadline: bigint
}): { to: Address; data: Hex } {
  const key = JPYC_USDC_POOL_KEY
  const actions = concatHex([
    toHex(v4Actions.MINT_POSITION, { size: 1 }),
    toHex(v4Actions.SETTLE_PAIR, { size: 1 }),
  ])
  const mint = encodeAbiParameters(
    parseAbiParameters(
      '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, int24 tickLower, int24 tickUpper, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData',
    ),
    [
      poolKeyTuple(key),
      MIN_TICK,
      MAX_TICK,
      params.liquidity,
      params.amount0Max,
      params.amount1Max,
      params.owner,
      '0x',
    ],
  )
  const settlePair = encodeAbiParameters(
    parseAbiParameters('address, address'),
    [key.currency0, key.currency1],
  )
  const unlockData = encodeAbiParameters(parseAbiParameters('bytes, bytes[]'), [
    actions,
    [mint, settlePair],
  ])
  return {
    to: uniswapV4.positionManager,
    data: encodeFunctionData({
      abi: positionManagerAbi,
      functionName: 'modifyLiquidities',
      args: [unlockData, params.deadline],
    }),
  }
}

export type AddLiquidityResult = {
  approvalTxHashes: Hex[]
  mintTxHash: Hex
  liquidity: bigint
  poolLiquidity: bigint
}

// 全範囲の流動性を足す一連の取引を送る。ERC-20→Permit2 と Permit2→PositionManager の承認が
// 足りない通貨だけ承認し、現在の価格から求めた流動性で位置を作る
export async function addFullRangeLiquidity(
  wallet: WalletClient<Transport, Chain | undefined, Account>,
  client: PublicClient,
  params: { amount0: bigint; amount1: bigint; deadline?: bigint },
): Promise<AddLiquidityResult> {
  const owner = wallet.account.address
  const key = JPYC_USDC_POOL_KEY
  const approvalTxHashes: Hex[] = []
  const send = async (tx: { to: Address; data: Hex }) => {
    const hash = await wallet.sendTransaction({
      account: wallet.account,
      chain: wallet.chain,
      to: tx.to,
      data: tx.data,
    })
    const receipt = await client.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`取引が失敗しました: ${hash}`)
    }
    return hash
  }

  for (const [token, amount] of [
    [key.currency0, params.amount0],
    [key.currency1, params.amount1],
  ] as const) {
    const erc20Allowance = await client.readContract({
      address: token,
      abi: erc20ApproveAbi,
      functionName: 'allowance',
      args: [owner, uniswapV4.permit2],
    })
    if (erc20Allowance < amount) {
      approvalTxHashes.push(
        await send(
          encodeErc20ApproveToPermit2({ token, amount: 2n ** 256n - 1n }),
        ),
      )
    }
    const [permitAmount, permitExpiration] = await client.readContract({
      address: uniswapV4.permit2,
      abi: permit2Abi,
      functionName: 'allowance',
      args: [owner, token, uniswapV4.positionManager],
    })
    const now = Math.floor(Date.now() / 1000)
    if (permitAmount < amount || permitExpiration < now + 600) {
      approvalTxHashes.push(
        await send(
          encodePermit2ApproveFor({
            token,
            spender: uniswapV4.positionManager,
            amount: maxUint160,
            // 1日で切れるようにして、承認を長く残さない
            expiration: now + 86400,
          }),
        ),
      )
    }
  }

  const { sqrtPriceX96 } = await readPoolState(client)
  // 丸めで上限を超えないよう、求めた流動性を 0.1% 減らしてから入れる
  const liquidity =
    (fullRangeLiquidityForAmounts(
      sqrtPriceX96,
      params.amount0,
      params.amount1,
    ) *
      999n) /
    1000n
  if (liquidity === 0n) {
    throw new Error('入れる量が少なすぎて流動性が 0 になります')
  }
  const deadline =
    params.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 1800)
  const mintTxHash = await send(
    encodeMintFullRange({
      liquidity,
      amount0Max: params.amount0,
      amount1Max: params.amount1,
      owner,
      deadline,
    }),
  )
  const { liquidity: poolLiquidity } = await readPoolState(client)
  return { approvalTxHashes, mintTxHash, liquidity, poolLiquidity }
}
