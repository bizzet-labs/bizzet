import {
  type Address,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  hashStruct,
  hashTypedData,
  keccak256,
  parseAbi,
  toHex,
  zeroAddress,
} from 'viem'
import { sepolia } from './addresses/sepolia.ts'

// Safe のオーナーの連結リストの先頭を表す番兵のアドレス
export const SENTINEL_OWNERS: Address =
  '0x0000000000000000000000000000000000000001'

export const safeOwnerAbi = parseAbi([
  'function nonce() view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
  'function removeOwner(address prevOwner, address owner, uint256 _threshold)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool success)',
])

// execTransaction の結果。Safe は成否をイベントで返し、失敗しても取引自体は通ることがあるため、イベントで確かめる
export const safeExecutionEventsAbi = parseAbi([
  'event ExecutionSuccess(bytes32 indexed txHash, uint256 payment)',
  'event ExecutionFailure(bytes32 indexed txHash, uint256 payment)',
])

export const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

// ウォレットで扱う通貨。小数の桁数は Sepolia の各コントラクトの decimals()（2026年9月27日確認）
export const tokens = [
  { symbol: 'JPYC', address: sepolia.tokens.jpyc, decimals: 18 },
  { symbol: 'USDC', address: sepolia.tokens.usdc, decimals: 6 },
] as const

export type TokenSymbol = (typeof tokens)[number]['symbol']

export function findToken(address: string) {
  return tokens.find((t) => t.address.toLowerCase() === address.toLowerCase())
}

// Safe v1.4.1 の SafeTx。メンバーはこのハッシュに署名する
const safeTxTypes = {
  SafeTx: [
    { type: 'address', name: 'to' },
    { type: 'uint256', name: 'value' },
    { type: 'bytes', name: 'data' },
    { type: 'uint8', name: 'operation' },
    { type: 'uint256', name: 'safeTxGas' },
    { type: 'uint256', name: 'baseGas' },
    { type: 'uint256', name: 'gasPrice' },
    { type: 'address', name: 'gasToken' },
    { type: 'address', name: 'refundReceiver' },
    { type: 'uint256', name: 'nonce' },
  ],
} as const

export type SafeTransactionData = {
  to: Address
  value: bigint
  data: Hex
  operation: 0 | 1
  nonce: bigint
}

// ガス代は中継用アカウントが払うため、Safe 自身の払い戻しの項目（safeTxGas など）はすべて 0 にする
export function hashSafeTransaction(safe: Address, tx: SafeTransactionData) {
  return hashTypedData({
    domain: { chainId: sepolia.chainId, verifyingContract: safe },
    types: safeTxTypes,
    primaryType: 'SafeTx',
    message: {
      ...tx,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
    },
  })
}

// SafeTx のハッシュの元になるバイト列（0x1901・ドメインの区切り・SafeTx の構造体のハッシュ）。
// Safe v1.4.1 の execTransaction は、コントラクト署名のオーナーに isValidSignature(bytes,bytes) で
// ハッシュではなくこのバイト列を渡すため、入れ子の署名ではこれが SafeMessage の中身になる
export function encodeSafeTransactionData(
  safe: Address,
  tx: SafeTransactionData,
) {
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
      [
        keccak256(
          toHex('EIP712Domain(uint256 chainId,address verifyingContract)'),
        ),
        BigInt(sepolia.chainId),
        safe,
      ],
    ),
  )
  const structHash = hashStruct({
    types: safeTxTypes,
    primaryType: 'SafeTx',
    data: {
      ...tx,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
    },
  })
  return concatHex(['0x1901', domainSeparator, structHash])
}

// Safe v1.4.1 の CompatibilityFallbackHandler が isValidSignature で検証する SafeMessage のハッシュ。
// ドメインはメッセージに署名する側の Safe で、getMessageHashForSafe(safe, message) と同じ値になる
export function hashSafeMessage(safe: Address, message: Hex) {
  return hashTypedData({
    domain: { chainId: sepolia.chainId, verifyingContract: safe },
    types: { SafeMessage: [{ type: 'bytes', name: 'message' }] },
    primaryType: 'SafeMessage',
    message: { message },
  })
}

// オーナーが Safe（ownerSafe）である Safe の取引に、ownerSafe のオーナーが署名するハッシュ。
// ownerSafe のオーナーは、この値を自分の Safe の取引と同じようにパスキーで署名する
export function hashNestedSafeTransaction(
  ownerSafe: Address,
  safe: Address,
  tx: SafeTransactionData,
) {
  return hashSafeMessage(ownerSafe, encodeSafeTransactionData(safe, tx))
}

export function encodeErc20Transfer(recipient: Address, amount: bigint) {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, amount],
  })
}

export function encodeAddOwner(owner: Address, threshold: bigint) {
  return encodeFunctionData({
    abi: safeOwnerAbi,
    functionName: 'addOwnerWithThreshold',
    args: [owner, threshold],
  })
}

// owners は Safe の getOwners() と同じ並び。削除する1つ前のオーナー（先頭なら番兵）を渡す必要がある
export function encodeRemoveOwner(
  owners: readonly Address[],
  owner: Address,
  threshold: bigint,
) {
  const index = owners.findIndex((o) => o.toLowerCase() === owner.toLowerCase())
  if (index < 0) throw new Error('削除するオーナーが Safe のオーナーにいません')
  const prevOwner =
    index === 0 ? SENTINEL_OWNERS : (owners[index - 1] as Address)
  return encodeFunctionData({
    abi: safeOwnerAbi,
    functionName: 'removeOwner',
    args: [prevOwner, owner, threshold],
  })
}

// 署名のそろった SafeTx を実行する calldata。signatures は encodeSafeSignatures で並べたもの。
// 払い戻しの項目は hashSafeTransaction と同じくすべて 0 にする
export function encodeExecTransaction(
  tx: SafeTransactionData,
  signatures: Hex,
) {
  return encodeFunctionData({
    abi: safeOwnerAbi,
    functionName: 'execTransaction',
    args: [
      tx.to,
      tx.value,
      tx.data,
      tx.operation,
      0n,
      0n,
      0n,
      zeroAddress,
      zeroAddress,
      signatures,
    ],
  })
}
