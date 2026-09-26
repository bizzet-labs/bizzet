import { fail, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth'
import { m } from '$lib/paraglide/messages.js'
import { getAuth } from '$lib/server/auth'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = () => ({ pageTitle: m.auth_login_title() })

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData()
    const email = form.get('email')
    const password = form.get('password')
    if (typeof email !== 'string' || typeof password !== 'string') {
      return fail(400, { email: '', message: m.common_error_invalid_input() })
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
          message: m.auth_login_failed(),
        })
      }
      throw e
    }
    redirect(303, '/')
  },
}
