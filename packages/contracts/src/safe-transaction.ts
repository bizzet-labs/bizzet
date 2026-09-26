import {
  type Address,
  encodeFunctionData,
  type Hex,
  hashTypedData,
  parseAbi,
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
