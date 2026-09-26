import { formatUnits } from 'viem'

// 画面の表示を揃えるための共通の書式。ベータ版は Sepolia だけを使うため、エクスプローラーも Sepolia の Etherscan に固定する
const EXPLORER_URL = 'https://sepolia.etherscan.io'

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`
}

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

// 最小単位の量（10進文字列）を、日本語の桁区切りつきの数にする。通貨記号は付けない
export function formatUnitsJa(
  amount: string,
  decimals: number,
  maximumFractionDigits: number,
): string {
  return Number(formatUnits(BigInt(amount), decimals)).toLocaleString('ja-JP', {
    maximumFractionDigits,
  })
}

// メンバーの権限の表示名。招待とマイページで同じ呼び方にする
export const roleLabels: Record<'owner' | 'approver' | 'viewer', string> = {
  owner: 'Owner',
  approver: 'Approver',
  viewer: 'Viewer',
}
