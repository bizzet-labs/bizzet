import { timingSafeEqual } from 'node:crypto'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { m } from '$lib/paraglide/messages.js'
import { syncDeposits } from '$lib/server/deposits'
import type { RequestHandler } from './$types'

// Vercel Cron の実行の上限に収まるよう、画面から呼ぶときより長めに読む
const CRON_BUDGET_MS = 20_000

// Vercel Cron から入金の取り込みを進める。画面を誰も開かない間も取り込みが遅れないようにするため。
// CRON_SECRET が未設定なら誰でも呼べてしまうため、常に拒否する
const handler: RequestHandler = async ({ request, locals }) => {
  const secret = env.CRON_SECRET
  if (!secret) error(503, m.home_error_cron_secret_missing())
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    error(401, m.common_error_forbidden())
  }

  const result = await syncDeposits(locals.db, {
    budgetMs: CRON_BUDGET_MS,
    force: true,
  })
  return json({
    scannedTo: result.scannedTo?.toString() ?? null,
    caughtUp: result.caughtUp,
    inserted: result.inserted,
  })
}

// Vercel Cron は GET で呼ぶため、GET と POST の両方で受ける
export const GET = handler
export const POST = handler
