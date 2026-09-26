import { fail, redirect } from '@sveltejs/kit'
import {
  createSession,
  issueChallenge,
  type LoginResponse,
  verifyLogin,
} from '$lib/server/auth'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ cookies }) => {
  return { challenge: issueChallenge(cookies) }
}

export const actions: Actions = {
  default: async ({ cookies, locals, request, url }) => {
    const form = await request.formData()
    const raw = form.get('response')
    if (typeof raw !== 'string') {
      return fail(400, { message: 'パスキーの応答がありません' })
    }

    let response: LoginResponse
    try {
      response = JSON.parse(raw) as LoginResponse
    } catch {
      return fail(400, { message: 'パスキーの応答を読み取れません' })
    }

    const member = await verifyLogin(locals.db, cookies, response, url.origin)
    if (!member) {
      return fail(401, {
        message:
          'このパスキーは登録されていません。管理者から招待を受けてください',
      })
    }

    await createSession(locals.db, cookies, member.id)
    redirect(303, '/')
  },
}
