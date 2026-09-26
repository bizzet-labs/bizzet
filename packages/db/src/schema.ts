import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

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

// メンバー。招待を受けてパスキーを登録した時点で作られる
export const members = pgTable('members', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id),
  role: memberRole('role').notNull(),
  passkeyId: text('passkey_id')
    .notNull()
    .unique()
    .references(() => passkeys.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Owner が発行する招待。トークンを含むリンクからパスキーを登録すると使用済みになる
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

// ダッシュボードのログインセッション。Cookie に id を置く
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  memberId: text('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
