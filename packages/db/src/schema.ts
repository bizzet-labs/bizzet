import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

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
