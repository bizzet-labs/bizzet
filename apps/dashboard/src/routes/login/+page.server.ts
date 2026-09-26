import { fail, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth'
import { getAuth } from '$lib/server/auth'
import type { Actions } from './$types'

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData()
    const email = form.get('email')
    const password = form.get('password')
    if (typeof email !== 'string' || typeof password !== 'string') {
      return fail(400, { email: '', message: '入力内容が正しくありません' })
    }

    // sveltekitCookies によりセッションの Cookie はここで発行される
    try {
      await getAuth().api.signInEmail({
        body: { email, password },
        headers: request.headers,
      })
    } catch (e) {
      if (e instanceof APIError) {
        return fail(401, {
          email,
          message: 'メールアドレスまたはパスワードが違います',
        })
      }
      throw e
    }
    redirect(303, '/')
  },
}
