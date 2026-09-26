import { describe, expect, it } from 'vitest'
import {
  buildPayUrl,
  formatTokenAmount,
  parsePriceTag,
  toTokenAmount,
} from './pay'

describe('parsePriceTag', () => {
  it('円の整数の価格と商品名を読む', () => {
    expect(
      parsePriceTag(new URLSearchParams('amount=500&item=Coffee')),
    ).toEqual({ priceJpy: 500, item: 'Coffee' })
  })

  it('商品名がなくても価格だけで読める', () => {
    expect(parsePriceTag(new URLSearchParams('amount=1'))).toEqual({
      priceJpy: 1,
      item: '',
    })
  })

  it.each([
    '',
    'amount=',
    'amount=0',
    'amount=-5',
    'amount=1.5',
    'amount=abc',
    'amount=1000001',
  ])('不正な価格（%s）は null を返す', (query) => {
    expect(parsePriceTag(new URLSearchParams(query))).toBeNull()
  })
})

describe('toTokenAmount', () => {
  it('JPYC は 1 円を 1 JPYC（18 桁）に換算する', () => {
    expect(toTokenAmount(500, 'JPYC')).toBe(500n * 10n ** 18n)
  })

  it('USDC はデモ用のレートで換算する', () => {
    expect(toTokenAmount(1500, 'USDC')).toBe(10_000_000n)
  })

  it('USDC の端数は店の受取額が不足しないよう切り上げる', () => {
    // 500 / 150 = 3.3333… USDC
    expect(toTokenAmount(500, 'USDC')).toBe(3_333_334n)
  })
})

describe('formatTokenAmount', () => {
  it('通貨ごとの桁で表示する', () => {
    expect(formatTokenAmount(500n * 10n ** 18n, 'JPYC')).toBe('500 JPYC')
    expect(formatTokenAmount(10_000_000n, 'USDC')).toBe('10.00 USDC')
    expect(formatTokenAmount(3_333_334n, 'USDC')).toBe('3.333334 USDC')
  })
})

describe('buildPayUrl', () => {
  it('名前・価格・商品名を決済ページの URL にする', () => {
    const url = buildPayUrl(
      'https://wallet.example',
      'shibuya.bizzet.eth',
      500,
      'Iced Coffee',
    )
    expect(url).toBe(
      'https://wallet.example/pay/shibuya.bizzet.eth?amount=500&item=Iced+Coffee',
    )
    const parsed = new URL(url)
    expect(parsePriceTag(parsed.searchParams)).toEqual({
      priceJpy: 500,
      item: 'Iced Coffee',
    })
  })
})
