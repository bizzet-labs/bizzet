import { json } from '@sveltejs/kit'
import { findMemberByPasskey, isHeadquartersSigner } from '$lib/server/member'
import { findOpenPasswordLink } from '$lib/server/password-link'
import type { RequestHandler } from './$types'

// 業務（WS-03）とマイページ（WS-05）に出す、自分の情報とできる操作
export const POST: RequestHandler = async ({ locals, request }) => {
  const { passkeyId } = (await request.json()) as { passkeyId?: unknown }
  const { member, group } = await findMemberByPasskey(locals.db, passkeyId)
  return json({
    member: {
      name: member.name,
      title: member.title,
      email: member.email,
      role: member.role,
    },
    group: { name: group.name, kind: group.kind },
    canSign: isHeadquartersSigner(member, group),
    hasPassword: member.userId !== null,
    passwordLink: await findOpenPasswordLink(locals.db, member),
  })
}
