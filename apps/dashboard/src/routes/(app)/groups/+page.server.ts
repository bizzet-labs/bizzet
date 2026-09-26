import { error } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import { listGroups } from '$lib/server/group-setup'
import { isHeadquartersMember } from '$lib/server/visibility'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const member = locals.member
  if (!member) error(401)
  const db = locals.db
  const [groups, isHeadquarters] = await Promise.all([
    listGroups(db, member),
    isHeadquartersMember(db, member),
  ])
  const isOwner = member.role === 'owner'
  return {
    pageTitle: m.common_nav_groups(),
    groups,
    // 設定画面は Owner が開ける。店舗の追加は本部の Owner だけが行える
    canOpenSettings: isOwner,
    canAddStore: isOwner && isHeadquarters,
  }
}
