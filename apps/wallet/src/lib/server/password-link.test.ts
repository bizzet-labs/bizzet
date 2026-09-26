import { describe, expect, it, vi } from 'vitest'

vi.mock('$env/dynamic/public', () => ({ env: {} }))

const { dashboardInviteUrl } = await import('./password-link')

describe('dashboardInviteUrl', () => {
  it('未設定ならローカルのダッシュボードを使う', () => {
    expect(dashboardInviteUrl('abc')).toBe('http://localhost:5174/invite/abc')
  })

  it('末尾のスラッシュを重ねない', () => {
    expect(dashboardInviteUrl('abc', 'https://dash.example.com/')).toBe(
      'https://dash.example.com/invite/abc',
    )
  })
})
