import type { Handle } from '@sveltejs/kit'
import { redirect } from '@sveltejs/kit'
import { getSessionMember } from '$lib/server/auth'
import { db } from '$lib/server/db'

// ログインなしで開ける画面
const PUBLIC_PATHS = new Set(['/login'])

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.db = db
  event.locals.member = await getSessionMember(db, event.cookies)

  const { pathname } = event.url
  if (!event.locals.member && !PUBLIC_PATHS.has(pathname)) {
    redirect(303, '/login')
  }
  if (event.locals.member && pathname === '/login') {
    redirect(303, '/')
  }
  return resolve(event)
}
