// JPYC/USDC のプールに全範囲の流動性を入れる（交換の前に1回実行する）。
// 使い方：LIQUIDITY_PRIVATE_KEY=0x... SEPOLIA_RPC_URL=https://... pnpm --filter @bizzet/contracts uniswap:liquidity
// LIQUIDITY_PRIVATE_KEY が無ければ ENS_OPERATOR_PRIVATE_KEY を使う。
// LIQUIDITY_USDC（既定は 20）・LIQUIDITY_JPYC（既定は 3000）は入れる量の上限で、
// 現在の価格に合わない側は一部だけが使われる
import { createWalletClient, type Hex, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import {
  createSepoliaPublicClient,
  DEFAULT_SEPOLIA_RPC_URL,
} from '../src/chain.ts'
import { erc20Abi } from '../src/safe-transaction.ts'
import {
  addFullRangeLiquidity,
  JPYC_USDC_POOL_KEY,
  readPoolState,
} from '../src/uniswap.ts'

const privateKey = (process.env.LIQUIDITY_PRIVATE_KEY ||
  process.env.ENS_OPERATOR_PRIVATE_KEY) as Hex | undefined
if (!privateKey) {
  throw new Error(
    'LIQUIDITY_PRIVATE_KEY（または ENS_OPERATOR_PRIVATE_KEY）を設定してください',
  )
}
const rpcUrl = process.env.SEPOLIA_RPC_URL
// プールの currency0 が USDC（6桁）、currency1 が JPYC（18桁）
const amount0 = parseUnits(process.env.LIQUIDITY_USDC || '20', 6)
const amount1 = parseUnits(process.env.LIQUIDITY_JPYC || '3000', 18)

const account = privateKeyToAccount(privateKey)
const publicClient = createSepoliaPublicClient(rpcUrl)
const wallet = createWalletClient({
  account,
  chain: sepolia,
  transport: http(rpcUrl || DEFAULT_SEPOLIA_RPC_URL),
})

console.error(`流動性を入れる鍵: ${account.address}`)
for (const [label, token, amount] of [
  ['USDC', JPYC_USDC_POOL_KEY.currency0, amount0],
  ['JPYC', JPYC_USDC_POOL_KEY.currency1, amount1],
] as const) {
  const balance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  if (balance < amount) {
    throw new Error(
      `${label} が足りません（残高 ${balance}、必要 ${amount}、最小単位）`,
    )
  }
}

const before = await readPoolState(publicClient)
console.error(
  `現在の tick: ${before.tick}、有効な流動性: ${before.liquidity.toString()}`,
)
const result = await addFullRangeLiquidity(wallet, publicClient, {
  amount0,
  amount1,
})

console.log(
  JSON.stringify(
    {
      provider: account.address,
      approvalTxHashes: result.approvalTxHashes,
      mintTxHash: result.mintTxHash,
      addedLiquidity: result.liquidity.toString(),
      poolLiquidity: result.poolLiquidity.toString(),
    },
    null,
    2,
  ),
)
