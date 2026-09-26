import { describe, expect, it } from 'vitest'
import { whyUnsignable } from './approvals'
import type { Group } from './member'

const signer = '0x00000000000000000000000000000000000000a1'
const other = '0x00000000000000000000000000000000000000b2'
const hqSafe = '0x00000000000000000000000000000000000000c3'
const storeSafe = '0x00000000000000000000000000000000000000d4'

const hq = {
  id: 'hq',
  name: '本部',
  kind: 'headquarters',
  safeAddress: hqSafe,
  safeOwners: [signer, other],
  safeThreshold: 2,
  safeSaltNonce: '0',
  safeDeployedAt: null,
  createdAt: new Date(),
} satisfies Group

type Tx = Parameters<typeof whyUnsignable>[0]
const tx = (safeAddress: string) => ({ safeAddress }) as Tx

describe('whyUnsignable', () => {
  it('本部の Safe の提案で、オーナーが未署名なら署名できる', () => {
    expect(whyUnsignable(tx(hqSafe), hq, signer, false, 1)).toBeNull()
  })

  it('アドレスの大文字と小文字の違いは同じ Safe として扱う', () => {
    expect(
      whyUnsignable(tx(hqSafe.toUpperCase()), hq, signer, false, 0),
    ).toBeNull()
  })

  it('店舗の Safe の提案は、入れ子のコントラクト署名が要るため署名できない', () => {
    expect(whyUnsignable(tx(storeSafe), hq, signer, false, 0)).toBe(
      'store_safe',
    )
  })

  it('署名済み・署名がそろった・オーナーでない場合は署名できない', () => {
    expect(whyUnsignable(tx(hqSafe), hq, signer, true, 1)).toBe(
      'already_signed',
    )
    expect(whyUnsignable(tx(hqSafe), hq, signer, false, 2)).toBe('ready')
    expect(
      whyUnsignable(
        tx(hqSafe),
        hq,
        '0x00000000000000000000000000000000000000e5',
        false,
        0,
      ),
    ).toBe('not_owner')
  })

  it('本部の Safe が未設定なら署名できない', () => {
    expect(
      whyUnsignable(tx(hqSafe), { ...hq, safeAddress: null }, signer, false, 0),
    ).toBe('no_headquarters')
  })
})
