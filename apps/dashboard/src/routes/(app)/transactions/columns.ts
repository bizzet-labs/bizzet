import { createColumnHelper, renderComponent } from '@tanstack/svelte-table'
import type { DataTableFeatures } from '@/components/data-table/data-table-features.js'
import { formatDateTime, formatTokenAmount, shortAddress } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import type { TransactionListItem } from '$lib/server/transactions'
import ContentCell from './content-cell.svelte'
import KindBadge from './kind-badge.svelte'
import { approvalsLabel, kindLabel } from './labels.js'
import MonoCell from './mono-cell.svelte'
import StatusBadge from './status-badge.svelte'

// 出金は金額と通貨、それ以外（オーナーの変更・Safe の設定）は説明を出す。説明が無ければ種類で代える
export function contentText(row: TransactionListItem) {
  if (row.kind === 'payout' && row.token && row.amount) {
    return m.transactions_amount({
      amount: formatTokenAmount(row.amount, row.token.decimals),
      symbol: row.token.symbol,
    })
  }
  return row.description || kindLabel(row.kind)
}

const columnHelper = createColumnHelper<
  DataTableFeatures,
  TransactionListItem
>()

// 必要な承認の数は本部の Safe のしきい値で、どの行も同じ値のため列の定義に渡す
export function transactionColumns(required: number | null) {
  return columnHelper.columns([
    columnHelper.accessor('kind', {
      header: () => m.transactions_column_kind(),
      cell: ({ row }) =>
        renderComponent(KindBadge, { kind: row.original.kind }),
    }),
    columnHelper.accessor('groupName', {
      header: () => m.transactions_column_group(),
    }),
    columnHelper.display({
      id: 'content',
      header: () => m.transactions_column_content(),
      cell: ({ row }) =>
        renderComponent(ContentCell, {
          href: `/transactions/${row.original.id}`,
          text: contentText(row.original),
        }),
    }),
    columnHelper.accessor('recipient', {
      header: () => m.transactions_column_recipient(),
      cell: ({ row }) =>
        row.original.kind === 'payout' && row.original.recipient
          ? renderComponent(MonoCell, {
              text: shortAddress(row.original.recipient),
              title: row.original.recipient,
            })
          : '',
    }),
    columnHelper.accessor('createdAt', {
      header: () => m.transactions_column_created_at(),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    }),
    columnHelper.accessor('signatureCount', {
      header: () => m.transactions_column_approvals(),
      cell: ({ row }) => approvalsLabel(row.original.signatureCount, required),
    }),
    columnHelper.accessor('status', {
      header: () => m.transactions_column_status(),
      cell: ({ row }) =>
        renderComponent(StatusBadge, { status: row.original.status }),
    }),
  ])
}
