import { createColumnHelper, renderComponent } from '@tanstack/svelte-table'
import type { DataTableFeatures } from '@/components/data-table/data-table-features.js'
import { formatTokenAmount } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import type { GroupKind } from '$lib/roles'
import HomeGroupCell from './home-group-cell.svelte'
import HomeSafeCell from './home-safe-cell.svelte'

export type HomeGroupRow = {
  id: string
  name: string
  kind: GroupKind
  safeAddress: string | null
  balances: Record<string, string | null>
}

export type HomeToken = { symbol: string; decimals: number }

const columnHelper = createColumnHelper<DataTableFeatures, HomeGroupRow>()

// 通貨の列は扱う通貨の一覧から作る。見出しは表示のたびに訳すため関数で渡す
export function createHomeGroupColumns(tokens: HomeToken[], isOwner: boolean) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: () => m.home_column_group(),
      cell: ({ row }) =>
        renderComponent(HomeGroupCell, {
          id: row.original.id,
          name: row.original.name,
          kind: row.original.kind,
        }),
    }),
    ...tokens.map((token) =>
      columnHelper.display({
        id: `balance-${token.symbol}`,
        header: () => token.symbol,
        cell: ({ row }) => {
          const amount = row.original.balances[token.symbol]
          return amount === null || amount === undefined
            ? '—'
            : formatTokenAmount(amount, token.decimals)
        },
      }),
    ),
    columnHelper.display({
      id: 'safe',
      header: () => m.home_column_safe(),
      cell: ({ row }) =>
        renderComponent(HomeSafeCell, {
          groupId: row.original.id,
          safeAddress: row.original.safeAddress,
          isOwner,
        }),
    }),
  ])
}
