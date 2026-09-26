import { error, json } from '@sveltejs/kit'
import type { Hex } from 'viem'
import { addSignature } from '$lib/server/approvals'
import { findMemberByPasskey } from '$lib/server/member'
import type { RequestHandler } from './$types'

const HEX = /^0x[0-9a-fA-F]+$/

type Body = {
  passkeyId?: unknown
  signature?: {
    authenticatorData?: unknown
    clientDataJSON?: unknown
    r?: unknown
    s?: unknown
  }
}

// SafeTx のハッシュへのパスキーの署名を受け取り、検証してから保存する
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const { passkeyId, signature } = (await request.json()) as Body
  const { member, passkey, group } = await findMemberByPasskey(
    locals.db,
    passkeyId,
  )
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
