import { and, eq, gt, invitations, isNull } from '@bizzet/db'
import { fail } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import { requireOwner } from '$lib/server/guards'
import {
  isRole,
  MemberChangeError,
  pendingOwnerChangeCounts,
  removeMember,
  updateMember,
} from '$lib/server/member-changes'
import { sortGroups } from '$lib/server/visibility'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const owner = requireOwner(locals.member)
  const db = locals.db

  const [groups, members, openInvitations, pendingCounts] = await Promise.all([
    db.query.groups.findMany(),
    db.query.members.findMany(),
    db.query.invitations.findMany({
      where: and(
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    }),
    pendingOwnerChangeCounts(db),
  ])

  const sortedGroups = sortGroups(groups)

  return {
    pageTitle: m.common_nav_members(),
    selfId: owner.id,
    groupOptions: sortedGroups.map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
    })),
    groups: sortedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      kind: group.kind,
      members: members
        .filter((member) => member.groupId === group.id)
        .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
        .map((member) => ({
          id: member.id,
          name: member.name,
          title: member.title,
          email: member.email,
          groupId: member.groupId,
          role: member.role,
          hasPassword: member.userId !== null,
          hasPasskey: member.passkeyId !== null,
          pendingOwnerChanges: pendingCounts.get(member.id) ?? 0,
          isSelf: member.id === owner.id,
        })),
    })),
    invitations: openInvitations
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((invitation) => ({
        token: invitation.token,
        kind: invitation.kind,
        name: invitation.name,
        email: invitation.email,
        groupName: groups.find((g) => g.id === invitation.groupId)?.name ?? '',
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      })),
  }
}

// 空の入力は null として保存する（未入力の名前・役職は一覧でメールアドレスや空欄に置き換える）
function optionalText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export const actions: Actions = {
  // 名前・役職・グループ・ロールを変える。本部の Safe のオーナーが変わる場合は提案も作る
  update: async ({ locals, request }) => {
    const owner = requireOwner(locals.member)
    const form = await request.formData()
    const memberId = form.get('memberId')
    const groupId = form.get('groupId')
    const role = form.get('role')
    if (typeof memberId !== 'string' || !memberId) {
      return fail(400, {
        action: 'update' as const,
        message: m.common_error_invalid_input(),
      })
    }
    if (typeof groupId !== 'string' || !groupId) {
      return fail(400, {
        action: 'update' as const,
        message: m.members_error_group_required(),
      })
    }
    if (!isRole(role)) {
      return fail(400, {
        action: 'update' as const,
        message: m.members_error_role_required(),
      })
    }
    try {
      const result = await updateMember(locals.db, owner, memberId, {
        name: optionalText(form.get('name')),
        title: optionalText(form.get('title')),
        groupId,
        role,
      })
      return {
        action: 'update' as const,
        updated: true,
        proposalId: result.proposalId,
      }
    } catch (e) {
      if (e instanceof MemberChangeError) {
        return fail(e.status, { action: 'update' as const, message: e.message })
      }
      throw e
    }
  },

  // メンバーを組織から外す。本部の Safe のオーナーだった場合は、オーナーから外す提案も作る
  remove: async ({ locals, request }) => {
    const owner = requireOwner(locals.member)
    const memberId = (await request.formData()).get('memberId')
    if (typeof memberId !== 'string' || !memberId) {
      return fail(400, {
        action: 'remove' as const,
        message: m.common_error_invalid_input(),
      })
    }
    try {
      const result = await removeMember(locals.db, owner, memberId)
      return {
        action: 'remove' as const,
        removed: true,
        proposalId: result.proposalId,
      }
    } catch (e) {
      if (e instanceof MemberChangeError) {
        return fail(e.status, { action: 'remove' as const, message: e.message })
      }
      throw e
    }
  },

  // 未使用の招待を取り消す。使用済みの招待は取り消せない
  revoke: async ({ locals, request }) => {
    requireOwner(locals.member)
    const token = (await request.formData()).get('token')
    if (typeof token !== 'string' || !token) {
      return fail(400, {
        action: 'revoke' as const,
        message: m.members_error_revoke_missing(),
      })
    }
    const deleted = await locals.db
      .delete(invitations)
      .where(and(eq(invitations.token, token), isNull(invitations.usedAt)))
      .returning({ token: invitations.token })
    if (deleted.length === 0) {
      return fail(404, {
        action: 'revoke' as const,
        message: m.members_error_revoke_gone(),
      })
    }
    return { action: 'revoke' as const, revoked: true }
  },
}
