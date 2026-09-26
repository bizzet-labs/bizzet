import { error } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'

// メンバーの管理（一覧・招待）は Owner だけが行える
export function requireOwner(member: App.Locals['member']) {
  if (!member) error(401)
  if (member.role !== 'owner') {
    error(403, m.common_error_forbidden())
  }
  return member
}
