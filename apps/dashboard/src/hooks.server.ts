import type { Handle } from '@sveltejs/kit'
import { redirect } from '@sveltejs/kit'
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { building } from '$app/environment'
import { auth, getSessionMember } from '$lib/server/auth'
import { db } from '$lib/server/db'

// ログインなしで開ける画面
const PUBLIC_PATHS = new Set(['/login'])
const PUBLIC_PREFIXES = ['/invite/', '/api/auth/']

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.db = db
  event.locals.member = await getSessionMember(db, event.request.headers)

  const { pathname } = event.url
  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (!event.locals.member && !isPublic) {
    redirect(303, '/login')
  }
  if (event.locals.member && pathname === '/login') {
    redirect(303, '/')
  }
  return svelteKitHandler({ event, resolve, auth, building })
}
