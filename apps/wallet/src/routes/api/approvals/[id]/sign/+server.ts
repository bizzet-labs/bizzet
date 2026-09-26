import { error, json } from '@sveltejs/kit'
import type { Hex } from 'viem'
import { addDemoSignature } from '$lib/server/approval-demo'
import { addSignature } from '$lib/server/approvals'
import { isDemoMode } from '$lib/server/demo'
import { requireMember } from '$lib/server/member'
import type { RequestHandler } from './$types'

const HEX = /^0x[0-9a-fA-F]+$/

type Body = {
  signature?: {
    authenticatorData?: unknown
    clientDataJSON?: unknown
    r?: unknown
    s?: unknown
  }
}

// 提案の署名するハッシュ（SafeTx か、店舗の提案なら本部の SafeMessage）へのパスキーの署名を受け取り、検証してから保存する
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const { signature } = (await request.json()) as Body
  const { member, passkey, group } = await requireMember(locals)
  // デモモードでは、パスキーの署名もチェーン上の検証も行わない
  if (isDemoMode()) {
    return json(
      await addDemoSignature(locals.db, member, group, passkey, params.id),
    )
  }
  const { authenticatorData, clientDataJSON, r, s } = signature ?? {}
  if (
    typeof authenticatorData !== 'string' ||
    !HEX.test(authenticatorData) ||
    typeof clientDataJSON !== 'string' ||
    typeof r !== 'string' ||
    !HEX.test(r) ||
    typeof s !== 'string' ||
    !HEX.test(s)
  ) {
    error(400, '署名の形式が正しくありません')
  }
  const result = await addSignature(
    locals.db,
    member,
    group,
    passkey,
    params.id,
    {
      authenticatorData: authenticatorData as Hex,
      clientDataJSON,
      r: BigInt(r),
      s: BigInt(s),
    },
  )
  return json(result)
}
