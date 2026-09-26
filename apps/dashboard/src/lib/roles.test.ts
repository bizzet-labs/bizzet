import { describe, expect, it } from 'vitest'
import { isRole, isRoleAllowedInGroup } from './roles'

describe('isRole', () => {
  it('owner・approver・viewer だけを Role として認める', () => {
    expect(isRole('owner')).toBe(true)
    expect(isRole('approver')).toBe(true)
    expect(isRole('viewer')).toBe(true)
  })

  it('未知の文字列や文字列以外は Role ではない', () => {
    expect(isRole('admin')).toBe(false)
    expect(isRole('')).toBe(false)
    expect(isRole(null)).toBe(false)
    expect(isRole(undefined)).toBe(false)
  })
})

describe('isRoleAllowedInGroup', () => {
  it('本部にはどのロールも割り当てられる', () => {
    expect(isRoleAllowedInGroup('headquarters', 'owner')).toBe(true)
    expect(isRoleAllowedInGroup('headquarters', 'approver')).toBe(true)
    expect(isRoleAllowedInGroup('headquarters', 'viewer')).toBe(true)
  })

  it('店舗には Viewer だけ割り当てられる', () => {
    expect(isRoleAllowedInGroup('store', 'viewer')).toBe(true)
    expect(isRoleAllowedInGroup('store', 'owner')).toBe(false)
    expect(isRoleAllowedInGroup('store', 'approver')).toBe(false)
  })
})
