import { randomUUID } from 'node:crypto'
import { createAuth, normalizeEmail } from './auth.ts'
import { createDb, LOCAL_DATABASE_URL } from './client.ts'
import { groups, members } from './schema.ts'

// 初期セットアップ。メンバーが1人もいないときだけ、本部のグループと最初の Owner を作る
// 使い方：pnpm db:seed（BOOTSTRAP_EMAIL / BOOTSTRAP_PASSWORD で上書き可）
const DEFAULT_EMAIL = 'admin@example.com'
const DEFAULT_PASSWORD = 'password'

async function main() {
  const email = normalizeEmail(process.env.BOOTSTRAP_EMAIL ?? DEFAULT_EMAIL)
  const password = process.env.BOOTSTRAP_PASSWORD ?? DEFAULT_PASSWORD

  const db = createDb(process.env.DATABASE_URL || LOCAL_DATABASE_URL)
  const auth = createAuth(db, {
    baseURL: process.env.DASHBOARD_URL ?? 'http://localhost:5174',
    secret: process.env.BETTER_AUTH_SECRET,
  })

  const existing = await db.query.members.findFirst()
  if (existing)
    throw new Error(
      'メンバーが既に存在するため、初期セットアップは実行できません',
    )

  let hq = await db.query.groups.findFirst({
    where: (g, { eq }) => eq(g.kind, 'headquarters'),
  })
  if (!hq) {
    const [created] = await db
      .insert(groups)
      .values({ id: randomUUID(), name: '本部', kind: 'headquarters' })
      .returning()
    hq = created
  }
  if (!hq) throw new Error('本部のグループを作成できませんでした')

  const { user } = await auth.api.signUpEmail({
    body: { name: email, email, password },
  })
  await db.insert(members).values({
    id: randomUUID(),
    email,
    groupId: hq.id,
    role: 'owner',
    userId: user.id,
  })

  console.log(`Owner を作成しました: ${email} / ${password}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
