import type { BadgeVariant } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'
import type {
  DisplayStatus,
  SafeTransactionKind,
} from '$lib/server/transactions'

// 一覧と詳細で同じ書き方にするため、種類と状態の表示をここにまとめる
export function kindLabel(kind: SafeTransactionKind) {
  switch (kind) {
    case 'payout':
      return m.transactions_kind_payout()
    case 'owner_change':
      return m.transactions_kind_owner_change()
    case 'safe_setup':
      return m.transactions_kind_safe_setup()
  }
}

export function statusLabel(status: DisplayStatus) {
  switch (status) {
    case 'requested':
      return m.transactions_status_requested()
    case 'awaiting_approval':
      return m.transactions_status_awaiting_approval()
    case 'submitted':
      return m.transactions_status_submitted()
    case 'executed':
      return m.transactions_status_executed()
    case 'rejected':
      return m.transactions_status_rejected()
  }
}

// 対応が要る状態（署名待ち）を目立たせ、終わった状態は控えめにする
export function statusVariant(status: DisplayStatus): BadgeVariant {
  switch (status) {
    case 'requested':
    case 'awaiting_approval':
      return 'default'
    case 'submitted':
      return 'secondary'
    case 'executed':
      return 'outline'
    case 'rejected':
      return 'destructive'
  }
}

export function approvalsLabel(count: number, required: number | null) {
  return required === null
    ? m.transactions_approvals_unknown({ count })
    : m.transactions_approvals({ count, required })
}
