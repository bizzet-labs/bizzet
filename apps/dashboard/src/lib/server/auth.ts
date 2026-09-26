import { type Auth, createAuth, type Db, eq, members } from '@bizzet/db'
import { sveltekitCookies } from 'better-auth/svelte-kit'
import { getRequestEvent } from '$app/server'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db'

export { normalizeEmail, PASSWORD_MIN_LENGTH } from '@bizzet/db'

export type Member = typeof members.$inferSelect

// Better Auth の本体。ルーティング（/api/auth/*）は hooks.server.ts でマウントする。
// ビルド時（prerender）に BETTER_AUTH_SECRET が無くても落ちないよう、最初のリクエストで初期化する
let instance: Auth | undefined
export function getAuth(): Auth {
  instance ??= createAuth(db, {
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    plugins: [sveltekitCookies(getRequestEvent)],
  })
  return instance
}

// リクエストの Cookie からログイン中のメンバーを返す。未ログインや、メンバーに紐づかないユーザーなら null
export async function getSessionMember(
  db: Db,
  headers: Headers,
): Promise<Member | null> {
  const session = await getAuth().api.getSession({ headers })
  if (!session) return null
  const member = await db.query.members.findFirst({
    where: eq(members.userId, session.user.id),
  })
  return member ?? null
}
