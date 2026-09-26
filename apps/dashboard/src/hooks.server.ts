import type { Handle } from '@sveltejs/kit'
import { redirect } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { building } from '$app/environment'
import { paraglideMiddleware } from '$lib/paraglide/server'
import { getAuth, getSessionMember } from '$lib/server/auth'
import { db } from '$lib/server/db'

// ログインなしで開ける画面。/api/cron/ は定期実行（Vercel Cron）の入口で、Bearer トークンで守る
const PUBLIC_PATHS = new Set(['/login'])
const PUBLIC_PREFIXES = ['/invite/', '/api/auth/', '/api/cron/']

// 表示言語を決め、html の lang 属性に入れる
const i18nHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request
    return resolve(event, {
      transformPageChunk: ({ html }) => html.replaceAll('%lang%', locale),
    })
  })

const authHandle: Handle = async ({ event, resolve }) => {
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
  return svelteKitHandler({ event, resolve, auth: getAuth(), building })
}

export const handle = sequence(i18nHandle, authHandle)
