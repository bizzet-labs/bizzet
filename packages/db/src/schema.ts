import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// グループの種類。本部が上位にあり、店舗はその配下に置く
export const groupKind = pgEnum('group_kind', ['headquarters', 'store'])

// メンバーのロール。Owner と Approver は Safe のオーナーになり、Viewer は閲覧だけ
export const memberRole = pgEnum('member_role', ['owner', 'approver', 'viewer'])

// 本部と店舗のグループ。グループごとに Safe を1つ持つ
export const groups = pgTable(
  'groups',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: groupKind('kind').notNull(),
    // 確定した Safe のアドレス。設定を確定するまでは null
    safeAddress: text('safe_address').unique(),
    // Safe の作成時の設定。アドレスはこの設定から CREATE2 で決まる。
    // オーナーは Safe の getOwners() と同じ並び（オーナーの変更が実行されたら更新する）
    safeOwners: jsonb('safe_owners').$type<string[]>(),
    safeThreshold: integer('safe_threshold'),
    safeSaltNonce: text('safe_salt_nonce'),
    // Safe をチェーンに配置した日時。配置前は null
    safeDeployedAt: timestamp('safe_deployed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // グループの名前は、大文字と小文字を区別せずに重複させない。同時に2つ作られても片方だけが通る
    uniqueIndex('groups_name_lower_idx').on(sql`lower(${table.name})`),
  ],
)

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
  // 表示用の名前と役職（例：経営、会計部、店長）。招待のときに入れ、未入力なら null
  name: text('name'),
  title: text('title'),
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

// 招待の種類。member はメンバーを作る招待、add_passkey と add_password は
// ログイン済みのメンバーが、もう一方のログイン手段を追加するためのリンク
export const invitationKind = pgEnum('invitation_kind', [
  'member',
  'add_passkey',
  'add_password',
])

// Owner が発行する招待と、ログイン手段の追加用リンク。リンクから登録を済ませると使用済みになる
export const invitations = pgTable('invitations', {
  token: text('token').primaryKey(),
  kind: invitationKind('kind').notNull().default('member'),
  // 追加用リンクの対象のメンバー。メンバーの招待では null
  memberId: text('member_id').references(() => members.id),
  // メンバーの招待で、作るメンバーに引き継ぐ名前と役職。未入力なら null
  name: text('name'),
  title: text('title'),
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

// Safe の取引の提案の種類。出金、オーナーの変更、Roles v2 の設定など、どれも
// 「Safe の取引にオーナーが署名し、中継用アカウントが送る」同じ流れで扱う
export const safeTransactionKind = pgEnum('safe_transaction_kind', [
  'payout',
  'owner_change',
  'safe_setup',
])

// 提案の状態。署名の数は safe_transaction_signatures から数える。
// open：送信前（署名が0件なら申請中、1件以上なら承認待ち）、submitted：中継用アカウントが送った、
// executed：Safe が実行した、rejected：実行前に取り下げた
export const safeTransactionStatus = pgEnum('safe_transaction_status', [
  'open',
  'submitted',
  'executed',
  'rejected',
])

// Safe の取引の提案。メンバーは safe_tx_hash（EIP-712 の SafeTx のハッシュ）に署名する
export const safeTransactions = pgTable(
  'safe_transactions',
  {
    id: text('id').primaryKey(),
    // 取引を実行する Safe のグループ
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    safeAddress: text('safe_address').notNull(),
    kind: safeTransactionKind('kind').notNull(),
    // Safe の execTransaction に渡す中身
    to: text('to').notNull(),
    value: text('value').notNull().default('0'),
    data: text('data').notNull().default('0x'),
    operation: integer('operation').notNull().default(0),
    nonce: integer('nonce').notNull(),
    safeTxHash: text('safe_tx_hash').notNull().unique(),
    // 画面に出す内容。出金なら通貨・金額・宛先、オーナーの変更なら対象のメンバー
    token: text('token'),
    amount: text('amount'),
    recipient: text('recipient'),
    targetMemberId: text('target_member_id').references(() => members.id),
    description: text('description'),
    status: safeTransactionStatus('status').notNull().default('open'),
    createdBy: text('created_by')
      .notNull()
      .references(() => members.id),
    // 中継用アカウントが送った取引と、Safe が実行した日時
    txHash: text('tx_hash'),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('safe_transactions_group_idx').on(table.groupId),
    // 同じ Safe・同じノンスの提案は、却下されたものを除いて1件だけにする（アプリ側で守る）
    index('safe_transactions_safe_nonce_idx').on(
      table.safeAddress,
      table.nonce,
    ),
  ],
)

// 提案への署名。1人のメンバーは1つの提案に1回だけ署名する
export const safeTransactionSignatures = pgTable(
  'safe_transaction_signatures',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => safeTransactions.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    // 署名したパスキーの署名者のアドレス
    signer: text('signer').notNull(),
    signature: text('signature').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('safe_transaction_signatures_member_idx').on(
      table.transactionId,
      table.memberId,
    ),
  ],
)

// 入金の履歴。グループの Safe に入った ERC-20（JPYC・USDC）の送金をチェーンから取り込む
export const deposits = pgTable(
  'deposits',
  {
    // チェーン ID・取引のハッシュ・ログの番号をつないだもの
    id: text('id').primaryKey(),
    chainId: integer('chain_id').notNull(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    safeAddress: text('safe_address').notNull(),
    token: text('token').notNull(),
    // 最小単位の金額（USDC なら 6 桁、JPYC なら 18 桁の小数を含まない整数）
    amount: text('amount').notNull(),
    from: text('from').notNull(),
    txHash: text('tx_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    blockNumber: text('block_number').notNull(),
    blockTimestamp: timestamp('block_timestamp', {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index('deposits_group_idx').on(table.groupId)],
)

// チェーンからの取り込みを、どのブロックまで済ませたか。キーは用途とチェーン（例：deposits:11155111）
export const indexCursors = pgTable('index_cursors', {
  key: text('key').primaryKey(),
  blockNumber: text('block_number').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
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
