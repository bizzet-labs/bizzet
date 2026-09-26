import { redirect } from '@sveltejs/kit'
import { deleteSession } from '$lib/server/auth'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ cookies, locals }) => {
  await deleteSession(locals.db, cookies)
  redirect(303, '/login')
}
