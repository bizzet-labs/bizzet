import { error } from '@sveltejs/kit'

// メンバーの管理（一覧・招待）は Owner だけが行える
export function requireOwner(member: App.Locals['member']) {
  if (!member) error(401)
  if (member.role !== 'owner') {
    error(403, 'メンバーの管理は Owner だけが行えます')
  }
  return member
}
