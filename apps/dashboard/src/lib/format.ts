import { formatUnits } from 'viem'
import { getLocale } from '$lib/paraglide/runtime'

// 表示言語に合わせた日付・金額の書き方。日本語は ja-JP、英語は en-US の形式にする
function intlLocale() {
  return getLocale() === 'en' ? 'en-US' : 'ja-JP'
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(intlLocale())
}

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString(intlLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// 最小単位の金額（文字列か bigint）を、小数の桁数に合わせて桁区切りで表示する
export function formatTokenAmount(amount: string | bigint, decimals: number) {
  const value = formatUnits(BigInt(amount), decimals)
  const [int, frac = ''] = value.split('.')
  const grouped = new Intl.NumberFormat(intlLocale()).format(BigInt(int ?? '0'))
  const trimmed = frac.slice(0, 6).replace(/0+$/, '')
  return trimmed ? `${grouped}.${trimmed}` : grouped
}

// アドレスを先頭6文字と末尾4文字に縮める
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
