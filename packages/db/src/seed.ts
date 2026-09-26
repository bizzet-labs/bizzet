import { randomBytes, randomUUID } from 'node:crypto'
import { createDb, LOCAL_DATABASE_URL } from './client.ts'
import { groups, invitations } from './schema.ts'

// 初期セットアップ。メンバーが1人もいないときだけ、本部のグループと最初の Owner への招待を作る
// 使い方：BOOTSTRAP_EMAIL=owner@example.com pnpm db:seed
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

async function main() {
  const email = process.env.BOOTSTRAP_EMAIL
  if (!email) throw new Error('BOOTSTRAP_EMAIL を指定してください')

  const db = createDb(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL)

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

  const token = randomBytes(32).toString('base64url')
  await db.insert(invitations).values({
    token,
    email,
    groupId: hq.id,
    role: 'owner',
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  })

  const walletUrl = process.env.WALLET_URL ?? 'http://localhost:5175'
  console.log(`招待リンク（7日間有効）: ${walletUrl}/invite/${token}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
