import {
  hashNestedSafeTransaction,
  hashSafeTransaction,
} from '@bizzet/contracts'
import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { signingHashOf, whyUnsignable } from './approvals'
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
  ensLabel: null,
  receivingCurrency: 'JPYC',
  ensStatus: 'unregistered',
  ensTxHash: null,
  createdAt: new Date(),
} satisfies Group

describe('whyUnsignable', () => {
  it('本部の Safe のオーナーが未署名なら署名できる', () => {
    expect(whyUnsignable(hq, signer, false, 1)).toBeNull()
  })

  it('署名者のアドレスの大文字と小文字の違いは同じオーナーとして扱う', () => {
    expect(whyUnsignable(hq, getAddress(signer), false, 0)).toBeNull()
  })

  it('署名済み・署名がそろった・オーナーでない場合は署名できない', () => {
    expect(whyUnsignable(hq, signer, true, 1)).toBe('already_signed')
    expect(whyUnsignable(hq, signer, false, 2)).toBe('ready')
    expect(
      whyUnsignable(hq, '0x00000000000000000000000000000000000000e5', false, 0),
    ).toBe('not_owner')
  })

  it('本部の Safe が未設定なら署名できない', () => {
    expect(whyUnsignable({ ...hq, safeAddress: null }, signer, false, 0)).toBe(
      'no_headquarters',
    )
  })
})

describe('signingHashOf', () => {
  const tx = (safeAddress: string) =>
    ({
      safeAddress,
      to: other,
      value: '0',
      data: '0x',
      operation: 0,
      nonce: 0,
      safeTxHash: hashSafeTransaction(getAddress(safeAddress), {
        to: other,
        value: 0n,
        data: '0x',
        operation: 0,
        nonce: 0n,
      }),
    }) as Parameters<typeof signingHashOf>[0]

  it('本部の Safe の提案では SafeTx のハッシュに署名する', () => {
    const item = tx(hqSafe)
    expect(signingHashOf(item, hq)).toBe(item.safeTxHash)
  })

  it('店舗の Safe の提案では、本部の Safe の SafeMessage のハッシュに署名する', () => {
    const item = tx(storeSafe)
    expect(signingHashOf(item, hq)).toBe(
      hashNestedSafeTransaction(getAddress(hqSafe), getAddress(storeSafe), {
        to: other,
        value: 0n,
        data: '0x',
        operation: 0,
        nonce: 0n,
      }),
    )
    expect(signingHashOf(item, hq)).not.toBe(item.safeTxHash)
  })
})
