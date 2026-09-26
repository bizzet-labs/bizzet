import {
  type Account,
  type Address,
  type Chain,
  concatHex,
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  type Hex,
  keccak256,
  numberToHex,
  type PublicClient,
  parseAbi,
  stringToHex,
  type Transport,
  toHex,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from 'viem'
import { normalize } from 'viem/ens'

// ENS が Sepolia に配置した ENSv2 のコントラクト。出典は ENS の公式ドキュメントの配置一覧（2026-09-27 確認）
export const ensV2 = {
  ethRegistrar: '0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca',
  ethRegistry: '0x657ea849311d3d5823348dded7c2aaafb3ede09e',
  rootRegistry: '0x9703dbd26dab89504490994138cf2c575251a9ce',
  verifiableFactory: '0x9e726eb570beb6bceb495ab8cda7df517d4e841c',
  userRegistryImpl: '0xa80338aaa8d23831cea25e858d1774534abb0263',
  permissionedResolverImpl: '0x14f09fd05d4585759e54844dc9b00147131cf243',
  universalResolver: '0x5d25c1d6acbb71b7a28aa7899618a3412a8303e3',
  rentPriceOracle: '0x9b0b9c65bdaf9794ff7697e4dcfb1f50581072bb',
  mockUsdc: '0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e',
} as const satisfies Record<string, Address>

// 受取通貨を書くテキストレコードのキー
export const CURRENCY_TEXT_KEY = 'bizzet.currency'

export type ReceivingCurrency = 'JPYC' | 'USDC'

export type ResolvedGroupName = {
  name: string
  address: Address | null
  currency: ReceivingCurrency | null
  description: string | null
}

// ラベルは英小文字・数字・ハイフンの3〜32文字
export function isValidLabel(label: string): boolean {
  return /^[a-z0-9-]{3,32}$/.test(label) && normalize(label) === label
}

// Universal Resolver で、グループの名前の受取先・受取通貨・表示名を読む。
// 名前やレコードがなければ、その項目を null にして返す
export async function resolveGroupName(
  client: PublicClient,
  name: string,
): Promise<ResolvedGroupName> {
  const normalized = normalize(name)
  const universalResolverAddress = ensV2.universalResolver
  const [address, currency, description] = await Promise.all([
    client
      .getEnsAddress({ name: normalized, universalResolverAddress })
      .catch(() => null),
    client
      .getEnsText({
        name: normalized,
        key: CURRENCY_TEXT_KEY,
        universalResolverAddress,
      })
      .catch(() => null),
    client
      .getEnsText({
        name: normalized,
        key: 'description',
        universalResolverAddress,
      })
      .catch(() => null),
  ])
  return {
    name: normalized,
    address: address ? getAddress(address) : null,
    currency: currency === 'JPYC' || currency === 'USDC' ? currency : null,
    description: description || null,
  }
}

// 以下の ABI は、Sepolia の配置の検証済みソース（Sourcify、2026-09-27 確認）から bizzet が使う関数だけを抜き出した

export const ethRegistrarAbi = parseAbi([
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function commitmentAt(bytes32 commitment) view returns (uint64)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256 tokenId)',
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
  'function isAvailable(string label) view returns (bool)',
  'function MIN_COMMITMENT_AGE() view returns (uint64)',
])

// ETHRegistry と UserRegistry はどちらも PermissionedRegistry を継ぐため、読み出しの関数は共通
export const permissionedRegistryAbi = parseAbi([
  'struct Grant { address account; uint256 roleBitmap; }',
  'function initialize(Grant[] grants)',
  'function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)',
  'function findOwner(string label) view returns (address)',
  'function findExpiry(string label) view returns (uint64)',
  'function getSubregistry(string label) view returns (address)',
  'function getResolver(string label) view returns (address)',
  'function setResolver(uint256 anyId, address resolver)',
  'function findTokenId(string label) view returns (uint256)',
  'function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)',
])

export const verifiableFactoryAbi = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data) returns (address proxy)',
  'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
])

// PermissionedResolver のセッターは、node ではなく DNS 形式にエンコードした名前を受け取る
export const permissionedResolverAbi = parseAbi([
  'struct Grant { address account; uint256 roleBitmap; }',
  'function initialize(Grant[] grants, bytes[] calls)',
  'function setAddress(bytes name, uint256 coinType, bytes addressBytes)',
  'function setText(bytes name, string key, string value)',
  'function multicall(bytes[] calls) returns (bytes[] results)',
  'function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)',
])

export const mockUsdcAbi = parseAbi([
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
])

// ENSv2 のロール。管理者のロールは、それぞれの値を128ビット左にずらした値
const ADMIN_SHIFT = 128n
export const registryRoles = {
  registrar: 1n << 0n,
  renew: 1n << 16n,
  setSubregistry: 1n << 20n,
  setResolver: 1n << 24n,
} as const
export const resolverRoles = {
  setAddress: 1n << 0n,
  setText: 1n << 4n,
} as const

function withAdmin(roles: Record<string, bigint>) {
  const value = Object.values(roles).reduce((a, b) => a | b, 0n)
  return value | (value << ADMIN_SHIFT)
}

// 運用者の鍵に与えるロール（登録・更新・サブレジストリとリゾルバの設定と、それぞれの管理者）
export const OPERATOR_REGISTRY_ROLES = withAdmin(registryRoles)
// 運用者の鍵に与えるロール（アドレスとテキストの書き込みと、それぞれの管理者）
export const OPERATOR_RESOLVER_ROLES = withAdmin(resolverRoles)

export const ETH_COIN_TYPE = 60n
// 登録の期間。本部の名前は1年ごとに登録する
export const HQ_REGISTRATION_DURATION = 365n * 24n * 60n * 60n

// 名前を DNS のワイヤー形式（ラベルの長さ + ラベル、末尾に 0）にする
export function dnsEncodeName(name: string): Hex {
  const labels = normalize(name).split('.')
  const parts = labels.map((label) => {
    const bytes = new TextEncoder().encode(label)
    if (bytes.length === 0 || bytes.length > 255) {
      throw new Error(`ラベルの長さが不正です: ${name}`)
    }
    return concatHex([numberToHex(bytes.length, { size: 1 }), toHex(bytes)])
  })
  return concatHex([...parts, '0x00'])
}

export function hqEnsName(hqLabel: string) {
  return `${hqLabel}.eth`
}

export function storeEnsName(storeLabel: string, hqName: string) {
  return `${storeLabel}.${hqName}`
}

export function encodeUserRegistryInitialize(operator: Address): Hex {
  return encodeFunctionData({
    abi: permissionedRegistryAbi,
    functionName: 'initialize',
    args: [[{ account: operator, roleBitmap: OPERATOR_REGISTRY_ROLES }]],
  })
}

export function encodeResolverInitialize(operator: Address): Hex {
  return encodeFunctionData({
    abi: permissionedResolverAbi,
    functionName: 'initialize',
    args: [[{ account: operator, roleBitmap: OPERATOR_RESOLVER_ROLES }], []],
  })
}

export type GroupRecords = {
  name: string
  // グループの Safe が未設定のうちは null にし、アドレスのレコードを書かない
  address: Address | null
  currency: ReceivingCurrency
  description: string
}

// 1つの名前のレコード（addr・受取通貨・表示名）を書く、リゾルバの multicall の calldata
export function encodeGroupRecords(records: GroupRecords): Hex {
  const name = dnsEncodeName(records.name)
  const calls: Hex[] = []
  if (records.address) {
    calls.push(
      encodeFunctionData({
        abi: permissionedResolverAbi,
        functionName: 'setAddress',
        args: [name, ETH_COIN_TYPE, getAddress(records.address)],
      }),
    )
  }
  calls.push(
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: 'setText',
      args: [name, CURRENCY_TEXT_KEY, records.currency],
    }),
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: 'setText',
      args: [name, 'description', records.description],
    }),
  )
  return encodeFunctionData({
    abi: permissionedResolverAbi,
    functionName: 'multicall',
    args: [calls],
  })
}

type OperatorWallet = WalletClient<Transport, Chain, Account>

async function send(
  wallet: OperatorWallet,
  publicClient: PublicClient,
  to: Address,
  data: Hex,
) {
  const hash = await wallet.sendTransaction({ to, data })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`取引が失敗しました: ${hash}`)
  }
  return receipt
}

// VerifiableFactory でプロキシを配置する。data は配置と同時に実装へ渡す initialize の calldata。
// 配置先は msg.sender とソルトから決まるが、クローンのバイトコードの再現を避けるため、イベントから読む
export async function deployEnsProxy(
  wallet: OperatorWallet,
  publicClient: PublicClient,
  implementation: Address,
  salt: bigint,
  data: Hex,
): Promise<Address> {
  const receipt = await send(
    wallet,
    publicClient,
    ensV2.verifiableFactory,
    encodeFunctionData({
      abi: verifiableFactoryAbi,
      functionName: 'deployProxy',
      args: [implementation, salt, data],
    }),
  )
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(ensV2.verifiableFactory)) {
      continue
    }
    const event = decodeEventLog({
      abi: verifiableFactoryAbi,
      data: log.data,
      topics: log.topics,
    })
    return getAddress(event.args.proxyAddress)
  }
  throw new Error('ProxyDeployed のイベントがありません')
}

export type HeadquartersSetup = {
  hqName: string
  subregistry: Address
  resolver: Address
  expiry: bigint
  // 今回の実行で登録した場合だけ、登録の取引のハッシュを持つ
  registerTxHash: Hex | null
}

// 本部の名前の初期セットアップ（設計の手順1〜5）。すでに運用者の鍵が持っていれば、
// 登録済みのサブレジストリとリゾルバを読んで返す。waitForCommitment は、commit のあと
// 最小の待ち時間（秒）を経過させる処理で、実ネットワークでは待機、fork では時刻を進める
export async function setupHeadquartersName(
  wallet: OperatorWallet,
  publicClient: PublicClient,
  hqLabel: string,
  waitForCommitment: (seconds: bigint) => Promise<void>,
): Promise<HeadquartersSetup> {
  if (!isValidLabel(hqLabel)) {
    throw new Error(`本部のラベルが不正です: ${hqLabel}`)
  }
  const operator = wallet.account.address
  const hqName = hqEnsName(hqLabel)
  const readEthRegistry = (
    functionName: 'findOwner' | 'getSubregistry' | 'getResolver' | 'findExpiry',
  ): Promise<unknown> =>
    publicClient.readContract({
      address: ensV2.ethRegistry,
      abi: permissionedRegistryAbi,
      functionName,
      args: [hqLabel],
    } as Parameters<typeof publicClient.readContract>[0])

  const currentOwner = (await readEthRegistry('findOwner')) as Address
  if (getAddress(currentOwner) === getAddress(operator)) {
    return {
      hqName,
      subregistry: getAddress(
        (await readEthRegistry('getSubregistry')) as Address,
      ),
      resolver: getAddress((await readEthRegistry('getResolver')) as Address),
      expiry: (await readEthRegistry('findExpiry')) as bigint,
      registerTxHash: null,
    }
  }
  const available = await publicClient.readContract({
    address: ensV2.ethRegistrar,
    abi: ethRegistrarAbi,
    functionName: 'isAvailable',
    args: [hqLabel],
  })
  if (!available) {
    throw new Error(`${hqName} は他の持ち主が登録済みです`)
  }

  // 手順1・2：サブレジストリとリゾルバのプロキシ。配置先は呼び出し元とソルトだけで決まり実装によらないため、
  // 2つのソルトを変える。また実行ごとにも変え、途中で失敗しても再実行できるようにする
  const salt = BigInt(keccak256(stringToHex(`${hqName}:${Date.now()}`)))
  const subregistry = await deployEnsProxy(
    wallet,
    publicClient,
    ensV2.userRegistryImpl,
    salt,
    encodeUserRegistryInitialize(operator),
  )
  const resolver = await deployEnsProxy(
    wallet,
    publicClient,
    ensV2.permissionedResolverImpl,
    salt + 1n,
    encodeResolverInitialize(operator),
  )

  // 手順3：登録料金ぶんの MockUSDC を発行し、ETHRegistrar に使わせる
  const duration = HQ_REGISTRATION_DURATION
  const [base, premium] = await publicClient.readContract({
    address: ensV2.ethRegistrar,
    abi: ethRegistrarAbi,
    functionName: 'getRegisterPrice',
    args: [hqLabel, duration, ensV2.mockUsdc],
  })
  // 予約を待つ間に料金が上がっても足りるよう、1割多く用意する
  const amount = ((base + premium) * 11n) / 10n
  await send(
    wallet,
    publicClient,
    ensV2.mockUsdc,
    encodeFunctionData({
      abi: mockUsdcAbi,
      functionName: 'mint',
      args: [operator, amount],
    }),
  )
  await send(
    wallet,
    publicClient,
    ensV2.mockUsdc,
    encodeFunctionData({
      abi: mockUsdcAbi,
      functionName: 'approve',
      args: [ensV2.ethRegistrar, amount],
    }),
  )

  // 手順4：予約して、最小の待ち時間を経過させる
  const secret = keccak256(stringToHex(`${hqName}:${salt}`))
  const commitment = await publicClient.readContract({
    address: ensV2.ethRegistrar,
    abi: ethRegistrarAbi,
    functionName: 'makeCommitment',
    args: [
      hqLabel,
      operator,
      secret,
      subregistry,
      resolver,
      duration,
      zeroHash,
    ],
  })
  await send(
    wallet,
    publicClient,
    ensV2.ethRegistrar,
    encodeFunctionData({
      abi: ethRegistrarAbi,
      functionName: 'commit',
      args: [commitment],
    }),
  )
  const minAge = await publicClient.readContract({
    address: ensV2.ethRegistrar,
    abi: ethRegistrarAbi,
    functionName: 'MIN_COMMITMENT_AGE',
  })
  await waitForCommitment(minAge + 5n)

  // 手順5：登録する
  const receipt = await send(
    wallet,
    publicClient,
    ensV2.ethRegistrar,
    encodeFunctionData({
      abi: ethRegistrarAbi,
      functionName: 'register',
      args: [
        hqLabel,
        operator,
        secret,
        subregistry,
        resolver,
        duration,
        ensV2.mockUsdc,
        zeroHash,
      ],
    }),
  )
  return {
    hqName,
    subregistry,
    resolver,
    expiry: (await readEthRegistry('findExpiry')) as bigint,
    registerTxHash: receipt.transactionHash,
  }
}

// 名前のレコードを1回の取引で書く
export async function writeGroupRecords(
  wallet: OperatorWallet,
  publicClient: PublicClient,
  resolver: Address,
  records: GroupRecords,
): Promise<Hex> {
  const receipt = await send(
    wallet,
    publicClient,
    resolver,
    encodeGroupRecords(records),
  )
  return receipt.transactionHash
}

export type StoreNameRegistration = {
  subregistry: Address
  resolver: Address
  // 店舗の名前の有効期限。本部の名前と同じにする
  expiry: bigint
  label: string
  records: Omit<GroupRecords, 'name'>
  hqName: string
}

// 店舗の名前をサブレジストリに登録し、続けてレコードを書く。登録済みで持ち主が運用者の鍵なら登録は飛ばす
export async function registerStoreName(
  wallet: OperatorWallet,
  publicClient: PublicClient,
  input: StoreNameRegistration,
): Promise<{ name: string; registerTxHash: Hex | null; recordsTxHash: Hex }> {
  if (!isValidLabel(input.label)) {
    throw new Error(`店舗のラベルが不正です: ${input.label}`)
  }
  const operator = wallet.account.address
  const name = storeEnsName(input.label, input.hqName)
  const owner = await publicClient.readContract({
    address: input.subregistry,
    abi: permissionedRegistryAbi,
    functionName: 'findOwner',
    args: [input.label],
  })
  let registerTxHash: Hex | null = null
  if (getAddress(owner) === zeroAddress) {
    const receipt = await send(
      wallet,
      publicClient,
      input.subregistry,
      encodeFunctionData({
        abi: permissionedRegistryAbi,
        functionName: 'register',
        args: [
          input.label,
          operator,
          zeroAddress,
          input.resolver,
          0n,
          input.expiry,
        ],
      }),
    )
    registerTxHash = receipt.transactionHash
  } else if (getAddress(owner) !== getAddress(operator)) {
    throw new Error(`${name} は他の持ち主が登録済みです`)
  }
  const recordsTxHash = await writeGroupRecords(
    wallet,
    publicClient,
    input.resolver,
    { ...input.records, name },
  )
  return { name, registerTxHash, recordsTxHash }
}
