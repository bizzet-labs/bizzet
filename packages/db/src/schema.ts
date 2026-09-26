import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// グループの種類。本部が上位にあり、店舗はその配下に置く
export const groupKind = pgEnum('group_kind', ['headquarters', 'store'])

// メンバーのロール。Owner と Approver は Safe のオーナーになり、Viewer は閲覧だけ
export const memberRole = pgEnum('member_role', ['owner', 'approver', 'viewer'])

// 本部と店舗のグループ
export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: groupKind('kind').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// パスキーと、Safe のオーナーになる署名者の対応表。
// ログイン時の WebAuthn の応答には公開鍵が含まれないため、登録時にここへ保存する
export const passkeys = pgTable('passkeys', {
  // WebAuthn のクレデンシャル ID
  id: text('id').primaryKey(),
  // P-256 の公開鍵（x と y をつなげた 64 バイトの 16 進）
  publicKey: text('public_key').notNull(),
  // 公開鍵から決まる署名者のアドレス
  signer: text('signer').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// メンバー。招待を受けてダッシュボードのパスワードを決めるか、ウォレットでパスキーを登録した時点で作られる
export const members = pgTable('members', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id),
  role: memberRole('role').notNull(),
  // ダッシュボードのログインに使う Better Auth のユーザー。ウォレットからだけ参加したメンバーは null
  userId: text('user_id')
    .unique()
    .references(() => user.id, { onDelete: 'set null' }),
  // ウォレットで登録したパスキー。ダッシュボードからだけ参加したメンバーは null
  passkeyId: text('passkey_id')
    .unique()
    .references(() => passkeys.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Owner が発行する招待。トークンを含むリンクからメンバー登録を済ませると使用済みになる
export const invitations = pgTable('invitations', {
  token: text('token').primaryKey(),
  email: text('email').notNull(),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id),
  role: memberRole('role').notNull(),
  // 招待した Owner。初期セットアップの招待は null
  invitedBy: text('invited_by').references(() => members.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ここから下は Better Auth が使うテーブル（ダッシュボードのメールアドレス/パスワードログイン）。
// 列は Better Auth の CLI が生成したものに合わせている

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))
