import { describe, expect, it } from 'vitest'
import {
  MemberChangeError,
  memberLabel,
  walletInviteUrl,
} from './member-changes'

describe('memberLabel', () => {
  it('名前があれば名前を使う', () => {
    expect(memberLabel({ name: '田中', email: 'tanaka@example.com' })).toBe(
      '田中',
    )
  })

  it('名前が未入力ならメールアドレスを使う', () => {
    expect(memberLabel({ name: null, email: 'tanaka@example.com' })).toBe(
      'tanaka@example.com',
    )
  })
})

describe('walletInviteUrl', () => {
  it('PUBLIC_WALLET_URL が未設定ならローカル開発のウォレットを指す', () => {
    expect(walletInviteUrl('abc')).toBe('http://localhost:5175/invite/abc')
  })
})

describe('MemberChangeError', () => {
  it('画面に見せる status とメッセージを保持する', () => {
    const error = new MemberChangeError(409, 'メンバーがいません')
    expect(error.status).toBe(409)
    expect(error.message).toBe('メンバーがいません')
    expect(error).toBeInstanceOf(Error)
  })
})
