import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { APIError, type BetterAuthPlugin, betterAuth } from 'better-auth'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { Db } from './client.ts'
import * as schema from './schema.ts'

export const PASSWORD_MIN_LENGTH = 8

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

type CreateAuthOptions = {
  baseURL?: string
  secret?: string
  plugins?: BetterAuthPlugin[]
}

// ダッシュボードのメールアドレス/パスワードログイン。
// ユーザー作成は招待を受けたメールアドレス（または最初の Owner）に限る
export function createAuth(db: Db, options: CreateAuthOptions = {}) {
  return betterAuth({
    baseURL: options.baseURL,
    secret: options.secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (data) => {
            const email = normalizeEmail(data.email)
            const anyMember = await db.query.members.findFirst()
            const invited = anyMember
              ? await db.query.invitations.findFirst({
                  where: and(
                    eq(schema.invitations.email, email),
                    isNull(schema.invitations.usedAt),
                    gt(schema.invitations.expiresAt, new Date()),
                  ),
                })
              : true
            if (!invited) {
              throw APIError.from('FORBIDDEN', {
                code: 'NOT_INVITED',
                message: '招待されていないメールアドレスです',
              })
            }
            return { data: { ...data, email } }
          },
        },
      },
    },
    plugins: options.plugins,
  })
}

export type Auth = ReturnType<typeof createAuth>
