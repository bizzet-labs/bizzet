import { m } from '$lib/paraglide/messages.js'
import {
  getRequiredApprovals,
  isInProgress,
  listTransactions,
  requireSignerRole,
} from '$lib/server/transactions'
import { isHeadquartersMember } from '$lib/server/visibility'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const member = requireSignerRole(locals.member)
  const [items, required, canCreate] = await Promise.all([
    listTransactions(locals.db, member),
    getRequiredApprovals(locals.db),
    // 出金を作れるのは本部の Owner と Approver だけのため、それ以外にはボタンを出さない
    isHeadquartersMember(locals.db, member),
  ])
  return {
    pageTitle: m.transactions_title(),
    required,
    canCreate,
    inProgress: items.filter((item) => isInProgress(item.status)),
    completed: items.filter((item) => !isInProgress(item.status)),
  }
}
