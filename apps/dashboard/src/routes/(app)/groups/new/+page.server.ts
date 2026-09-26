import { error, fail, redirect } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import { createStore } from '$lib/server/group-setup'
import { requireOwner } from '$lib/server/guards'
import { getHeadquarters } from '$lib/server/safe'
import { isHeadquartersMember } from '$lib/server/visibility'
import type { Actions, PageServerLoad } from './$types'

// 店舗を作れるのは本部の Owner だけ。店舗の Owner が別の店舗を作れないようにする
async function requireHeadquartersOwner(locals: App.Locals) {
  const owner = requireOwner(locals.member)
  if (!(await isHeadquartersMember(locals.db, owner))) {
    error(403, m.groups_error_hq_owner_only())
  }
  return owner
}

export const load: PageServerLoad = async ({ locals }) => {
  await requireHeadquartersOwner(locals)
  const hq = await getHeadquarters(locals.db)
  return {
    pageTitle: m.groups_new_title(),
    headquartersConfigured: Boolean(hq?.safeAddress),
  }
}

const REASON_MESSAGES = {
  name_required: () => m.groups_error_name_required(),
  name_taken: () => m.groups_error_name_taken(),
  no_headquarters: () => m.groups_error_no_headquarters(),
} as const

export const actions: Actions = {
  default: async ({ locals, request }) => {
    await requireHeadquartersOwner(locals)
    const name = (await request.formData()).get('name')
    const value = typeof name === 'string' ? name : ''
    const result = await createStore(locals.db, value)
    if (!result.ok) {
      return fail(400, {
        name: value,
        message: REASON_MESSAGES[result.reason](),
      })
    }
    redirect(303, `/groups/${result.id}/settings`)
  },
}
