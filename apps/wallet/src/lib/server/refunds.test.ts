import { describe, expect, it, vi } from 'vitest'

// チェーンの読み取りはテストしない純粋な関数だけを使うため、RPC の設定を読まないよう差し替える
vi.mock('$lib/chain', () => ({ publicClient: {} }))

const { chooseNonce, isRefund, parseRecipient, parseRefundAmount } =
  await import('./refunds')

const safe = '0x1111111111111111111111111111111111111111'

describe('parseRefundAmount', () => {
  it('小数を最小単位に直す', () => {
    expect(parseRefundAmount('1.5', 'USDC', 6)).toEqual({
      ok: true,
      value: 1_500_000n,
    })
    expect(parseRefundAmount(' 1000 ', 'JPYC', 18)).toEqual({
      ok: true,
      value: 1000n * 10n ** 18n,
    })
  })

  it('小数の桁が多すぎる金額は丸めずに断る', () => {
    const result = parseRefundAmount('0.0000001', 'USDC', 6)
    expect(result.ok).toBe(false)
  })

  it('0・負の数・指数表記・桁区切りを断る', () => {
    for (const input of ['0', '0.0', '-1', '1e3', '1,000', '', 'abc', '.5']) {
      expect(parseRefundAmount(input, 'JPYC', 18).ok).toBe(false)
    }
  })
})

describe('parseRecipient', () => {
  it('チェックサム付きのアドレスに直す', () => {
    const result = parseRecipient(
      '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      safe,
    )
    expect(result).toEqual({
      ok: true,
      value: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    })
  })

  it('不正なアドレス・ゼロアドレス・Safe 自身を断る', () => {
    expect(parseRecipient('0x1234', safe).ok).toBe(false)
    expect(
      parseRecipient('0x0000000000000000000000000000000000000000', safe).ok,
    ).toBe(false)
    expect(parseRecipient(safe, safe).ok).toBe(false)
  })
})

describe('chooseNonce', () => {
  it('使われていなければチェーン上のノンスを使う', () => {
    expect(chooseNonce(3n, [])).toBe(3n)
    expect(chooseNonce(3n, [1n, 2n])).toBe(3n)
  })

  it('使われている番号を飛ばす', () => {
    expect(chooseNonce(0n, [0n, 1n, 2n])).toBe(3n)
  })

  it('却下で空いた番号を埋める', () => {
    expect(chooseNonce(0n, [0n, 2n])).toBe(1n)
  })
})

describe('isRefund', () => {
  it('説明の先頭で返金を見分ける', () => {
    expect(isRefund('返金')).toBe(true)
    expect(isRefund('返金：注文 123')).toBe(true)
    expect(isRefund('仕入れの支払い')).toBe(false)
    expect(isRefund(null)).toBe(false)
  })
})
