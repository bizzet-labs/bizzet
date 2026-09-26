import { randomBytes, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createAuth, normalizeEmail } from './auth.ts'
import { createDb, LOCAL_DATABASE_URL } from './client.ts'
import { ensSettings, groups, members, passkeys, user } from './schema.ts'

// デモモード（DEMO_MODE=1）用のデータ。本部・3人のメンバー・模擬のパスキー・本部の Safe・ENS の設定を作る。
// 既存のデータは消さず、足りないものだけを足す（同じメールアドレスのメンバーや設定済みの Safe は残す）
// 使い方：pnpm db:seed:demo
const PASSWORD = 'password'

// 模擬の値。チェーンには存在しないアドレス
const HQ_SAFE_ADDRESS = '0xb12e7000000000000000000000000000000000a1'
const HQ_THRESHOLD = 2
const ENS_HQ_NAME = 'bizzet.eth'
const ENS_SUBREGISTRY = '0xb12e7000000000000000000000000000000000e1'
const ENS_RESOLVER = '0xb12e7000000000000000000000000000000000e2'

const DEMO_MEMBERS = [
  {
    email: 'tanaka@example.com',
    name: '田中',
    title: '経営',
    role: 'owner',
    signer: '0xb12e700000000000000000000000000000000d01',
  },
  {
    email: 'sato@example.com',
    name: '佐藤',
    title: '会計部',
    role: 'approver',
    signer: '0xb12e700000000000000000000000000000000d02',
  },
  {
    email: 'suzuki@example.com',
    name: '鈴木',
    title: '会計部',
    role: 'approver',
    signer: '0xb12e700000000000000000000000000000000d03',
  },
] as const

async function main() {
  const db = createDb(process.env.DATABASE_URL || LOCAL_DATABASE_URL)
  const auth = createAuth(db, {
    baseURL: process.env.DASHBOARD_URL ?? 'http://localhost:5174',
    secret: process.env.BETTER_AUTH_SECRET,
  })

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

  const signers: string[] = []
  for (const demo of DEMO_MEMBERS) {
    const email = normalizeEmail(demo.email)
    const existing = await db.query.members.findFirst({
      where: eq(members.email, email),
    })
    if (existing) {
      console.log(`既にあるため作りません: ${email}`)
      const passkey = existing.passkeyId
        ? await db.query.passkeys.findFirst({
            where: eq(passkeys.id, existing.passkeyId),
          })
        : undefined
      if (passkey) signers.push(passkey.signer)
      continue
    }

    // 模擬のパスキー。公開鍵は乱数、署名者のアドレスは固定の値にする
    let passkeyId: string | null = null
    const taken = await db.query.passkeys.findFirst({
      where: eq(passkeys.signer, demo.signer),
    })
    if (!taken) {
      passkeyId = randomBytes(16).toString('base64url')
      await db.insert(passkeys).values({
        id: passkeyId,
        publicKey: randomBytes(64).toString('hex'),
        signer: demo.signer,
      })
      signers.push(demo.signer)
    }

    // ダッシュボードのログインは Owner だけに作る
    let userId: string | null = null
    if (demo.role === 'owner') {
      const found = await db.query.user.findFirst({
        where: eq(user.email, email),
      })
      if (found) {
        userId = found.id
      } else {
        const { user: created } = await auth.api.signUpEmail({
          body: { name: demo.name, email, password: PASSWORD },
        })
        userId = created.id
      }
    }

    await db.insert(members).values({
      id: randomUUID(),
      email,
      name: demo.name,
      title: demo.title,
      groupId: hq.id,
      role: demo.role,
      userId,
      passkeyId,
    })
    console.log(`メンバーを作成しました: ${demo.name}（${demo.role}）${email}`)
  }

  // 本部の Safe。設定済みなら上書きしない
  if (hq.safeAddress) {
    console.log(`本部の Safe は設定済みのため変えません: ${hq.safeAddress}`)
  } else if (signers.length < 3) {
    console.log('署名者が3人そろわないため、本部の Safe は設定しません')
  } else {
    await db
      .update(groups)
      .set({
        safeAddress: HQ_SAFE_ADDRESS,
        safeOwners: signers,
        safeThreshold: HQ_THRESHOLD,
        safeSaltNonce: '0',
        safeDeployedAt: new Date(),
      })
      .where(eq(groups.id, hq.id))
    console.log(`本部の Safe を設定しました: ${HQ_SAFE_ADDRESS}`)
  }

  // ENS の設定。既にあれば変えない
  const inserted = await db
    .insert(ensSettings)
    .values({
      hqName: ENS_HQ_NAME,
      subregistryAddress: ENS_SUBREGISTRY,
      resolverAddress: ENS_RESOLVER,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoNothing()
    .returning({ id: ensSettings.id })
  console.log(
    inserted.length > 0
      ? `ENS の設定を作成しました: ${ENS_HQ_NAME}`
      : 'ENS の設定は既にあるため変えません',
  )

  if (hq.ensStatus !== 'registered') {
    await db
      .update(groups)
      .set({
        ensStatus: 'registered',
        ensTxHash: `0x${randomBytes(32).toString('hex')}`,
      })
      .where(eq(groups.id, hq.id))
  }

  console.log('')
  console.log('ダッシュボードのログイン:')
  console.log(`  ${DEMO_MEMBERS[0].email} / ${PASSWORD}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
