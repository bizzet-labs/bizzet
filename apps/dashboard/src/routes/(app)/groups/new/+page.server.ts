import { error, fail, redirect } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import { getEnsSettings, trySyncGroupEns } from '$lib/server/ens'
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
  const [hq, ens] = await Promise.all([
    getHeadquarters(locals.db),
    getEnsSettings(locals.db),
  ])
  return {
    pageTitle: m.groups_new_title(),
    headquartersConfigured: Boolean(hq?.safeAddress),
    // ラベルの入力欄に、できる名前の例として本部の名前を添える
    hqEnsName: ens?.hqName ?? null,
  }
}

const REASON_MESSAGES = {
  name_required: () => m.groups_error_name_required(),
  name_taken: () => m.groups_error_name_taken(),
  no_headquarters: () => m.groups_error_no_headquarters(),
  invalid_label: () => m.groups_error_invalid_label(),
  label_taken: () => m.groups_error_label_taken(),
} as const

export const actions: Actions = {
  default: async ({ locals, request }) => {
    await requireHeadquartersOwner(locals)
    const formData = await request.formData()
    const name = formData.get('name')
    const label = formData.get('label')
    const value = typeof name === 'string' ? name : ''
    const labelValue = typeof label === 'string' ? label : ''
    const result = await createStore(locals.db, value, labelValue)
    if (!result.ok) {
      return fail(400, {
        name: value,
        label: labelValue,
        labelError:
          result.reason === 'invalid_label' || result.reason === 'label_taken',
        message: REASON_MESSAGES[result.reason](),
      })
    }
    // 店舗の名前を登録する。失敗しても店舗は残し、状態を設定画面に出してやり直せるようにする
    await trySyncGroupEns(locals.db, result.id)
    redirect(303, `/groups/${result.id}/settings`)
  },
}
