import type { ReceivingCurrency } from '@bizzet/contracts'
import { formatUnits } from 'viem'

// 仮置き：USDC で受け取る店の価格を円から換算するデモ用の固定レート（1 USD = 150 円）。
// 決済時の交換（P-03）を Checkout コントラクトで扱う時点で、オラクルの価格に置き換える
export const DEMO_JPY_PER_USD = 150

// 値札に載せる価格の上限。桁の打ち間違いで大金を送らないようにする
export const MAX_PRICE_JPY = 1_000_000

const DECIMALS: Record<ReceivingCurrency, number> = { JPYC: 18, USDC: 6 }

export type PriceTag = {
  priceJpy: number
  item: string
}

// 値札の URL の amount（円・整数）と item（商品名）を読む。価格が不正なら null を返す
export function parsePriceTag(params: URLSearchParams): PriceTag | null {
  const raw = params.get('amount') ?? ''
  if (!/^[0-9]+$/.test(raw)) return null
  const priceJpy = Number(raw)
  if (priceJpy <= 0 || priceJpy > MAX_PRICE_JPY) return null
  const item = (params.get('item') ?? '').trim().slice(0, 64)
  return { priceJpy, item }
}

// 円の価格を、受取通貨の最小単位の量に換算する。JPYC は 1 円 = 1 JPYC、
// USDC はデモ用のレートで換算し、店の受取額が不足しないよう端数を切り上げる
export function toTokenAmount(
  priceJpy: number,
  currency: ReceivingCurrency,
): bigint {
  const yen = BigInt(priceJpy)
  if (currency === 'JPYC') return yen * 10n ** BigInt(DECIMALS.JPYC)
  const rate = BigInt(DEMO_JPY_PER_USD)
  return (yen * 10n ** BigInt(DECIMALS.USDC) + rate - 1n) / rate
}

// 最小単位の量を、通貨記号つきの表示用の文字列にする
export function formatTokenAmount(
  amount: bigint,
  currency: ReceivingCurrency,
): string {
  const value = Number(formatUnits(amount, DECIMALS[currency]))
  const digits = currency === 'USDC' ? 2 : 0
  return `${value.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: currency === 'USDC' ? 6 : 0,
  })} ${currency}`
}

// 値札の QR に入れる決済ページの URL を作る
export function buildPayUrl(
  origin: string,
  name: string,
  priceJpy: number,
  item: string,
): string {
  const url = new URL(`/pay/${encodeURIComponent(name)}`, origin)
  url.searchParams.set('amount', String(priceJpy))
  if (item) url.searchParams.set('item', item)
  return url.toString()
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
