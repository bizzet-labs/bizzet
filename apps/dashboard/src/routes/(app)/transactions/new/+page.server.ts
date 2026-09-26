import { encodeErc20Transfer, tokens } from '@bizzet/contracts'
import { error, fail, redirect } from '@sveltejs/kit'
import { getAddress, isAddress, parseUnits, zeroAddress } from 'viem'
import { formatTokenAmount } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import { createSafeTransaction } from '$lib/server/safe'
import { getTokenBalance, requireSignerRole } from '$lib/server/transactions'
import { getVisibleGroups, isHeadquartersMember } from '$lib/server/visibility'
import type { Actions, PageServerLoad } from './$types'

const MEMO_MAX_LENGTH = 200
// 小数点を含む正の十進数。指数表記や桁区切りは受け付けない
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

// 出金を作れるのは本部の Owner と Approver。署名者は本部の Safe のオーナーのため、店舗のメンバーは作らない
async function requirePayoutCreator(locals: App.Locals) {
  const member = requireSignerRole(locals.member)
  if (!(await isHeadquartersMember(locals.db, member))) {
    error(403, m.transactions_error_headquarters_only())
  }
  return member
}

// Safe が設定済みの、見られるグループ
async function payingGroups(locals: App.Locals, member: App.Locals['member']) {
  if (!member) return []
  const visible = await getVisibleGroups(locals.db, member)
  return visible.filter((g) => g.safeAddress !== null)
}

export const load: PageServerLoad = async ({ locals }) => {
  const member = await requirePayoutCreator(locals)
  const groups = await payingGroups(locals, member)
  // 選んだグループと通貨の残高をすぐ出せるよう、組み合わせごとに先に読む。読めなかった分は null
  const balances = await Promise.all(
    groups.flatMap((group) =>
      tokens.map(async (token) => {
        const balance = await getTokenBalance(
          group.safeAddress as string,
          token.address,
        )
        return {
          groupId: group.id,
          symbol: token.symbol,
          balance: balance?.toString() ?? null,
        }
      }),
    ),
  )
  return {
    pageTitle: m.transactions_new_title(),
    groups: groups.map((g) => ({ id: g.id, name: g.name, kind: g.kind })),
    tokens: tokens.map((t) => ({ symbol: t.symbol, decimals: t.decimals })),
    balances,
    memoMaxLength: MEMO_MAX_LENGTH,
  }
}

type FieldName = 'groupId' | 'token' | 'amount' | 'recipient' | 'memo'

export const actions: Actions = {
  default: async ({ locals, request }) => {
    const member = await requirePayoutCreator(locals)
    const form = await request.formData()
    const values = {
      groupId: String(form.get('groupId') ?? ''),
      token: String(form.get('token') ?? ''),
      amount: String(form.get('amount') ?? '').trim(),
      recipient: String(form.get('recipient') ?? '').trim(),
      memo: String(form.get('memo') ?? '').trim(),
    }
    const invalid = (field: FieldName, message: string) =>
      fail(400, { values, field, message })

    const groups = await payingGroups(locals, member)
    const group = groups.find((g) => g.id === values.groupId)
    if (!values.groupId) {
      return invalid('groupId', m.transactions_error_group_required())
    }
    if (!group?.safeAddress) {
      return invalid('groupId', m.transactions_error_group_no_safe())
    }
    const safe = getAddress(group.safeAddress)

    const token = tokens.find((t) => t.symbol === values.token)
    if (!token) {
      return invalid('token', m.transactions_error_token_required())
    }

    if (!DECIMAL_PATTERN.test(values.amount)) {
      return invalid('amount', m.transactions_error_amount_invalid())
    }
    // parseUnits は桁あふれを丸めるため、丸めで金額が変わらないよう先に桁数を確かめる
    const fraction = values.amount.split('.')[1] ?? ''
    if (fraction.length > token.decimals) {
      return invalid(
        'amount',
        m.transactions_error_amount_decimals({
          symbol: token.symbol,
          decimals: token.decimals,
        }),
      )
    }
    const amount = parseUnits(values.amount, token.decimals)
    if (amount <= 0n) {
      return invalid('amount', m.transactions_error_amount_invalid())
    }

    if (!isAddress(values.recipient)) {
      return invalid('recipient', m.transactions_error_recipient_invalid())
    }
    const recipient = getAddress(values.recipient)
    if (recipient === zeroAddress) {
      return invalid('recipient', m.transactions_error_recipient_zero())
    }
    if (recipient === safe) {
      return invalid('recipient', m.transactions_error_recipient_self())
    }

    if (values.memo.length > MEMO_MAX_LENGTH) {
      return invalid(
        'memo',
        m.transactions_error_memo_too_long({ max: MEMO_MAX_LENGTH }),
      )
    }

    // 残高を超える出金は実行に失敗するため作らせない。読み取れないときは画面で注意を出したうえで通す
    const balance = await getTokenBalance(safe, token.address)
    if (balance !== null && amount > balance) {
      return invalid(
        'amount',
        m.transactions_error_insufficient_balance({
          balance: formatTokenAmount(balance, token.decimals),
          symbol: token.symbol,
        }),
      )
    }

    let id: string
    try {
      const created = await createSafeTransaction(locals.db, {
        group,
        kind: 'payout',
        to: token.address,
        data: encodeErc20Transfer(recipient, amount),
        token: token.address,
        amount: amount.toString(),
        recipient,
        description: values.memo || null,
        createdBy: member.id,
      })
      id = created.id
    } catch (e) {
      // ノンスの割り当てにチェーンの読み取りが要るため、RPC の失敗はやり直しを促す
      console.error(e)
      return fail(503, {
        values,
        field: null,
        message: m.transactions_error_create_failed(),
      })
    }
    redirect(303, `/transactions/${id}`)
  },
}
