import { createColumnHelper, renderComponent } from '@tanstack/svelte-table'
import type { DataTableFeatures } from '@/components/data-table/data-table-features.js'
import { formatDateTime, shortAddress } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import AmountCell from './amount-cell.svelte'
import ExternalLinkCell from './external-link-cell.svelte'

export type DepositRow = {
  id: string
  blockTimestamp: string
  amount: string
  symbol: string
  decimals: number
  from: string
  fromUrl: string
  txHash: string
  txUrl: string
}

const columnHelper = createColumnHelper<DataTableFeatures, DepositRow>()

// 見出しは表示のたびに訳すため、文字列ではなく関数で渡す
export const depositColumns = columnHelper.columns([
  columnHelper.accessor('blockTimestamp', {
    header: () => m.home_deposit_column_time(),
    cell: ({ row }) => formatDateTime(row.original.blockTimestamp),
  }),
  columnHelper.accessor('amount', {
    header: () => m.home_deposit_column_amount(),
    cell: ({ row }) =>
      renderComponent(AmountCell, {
        amount: row.original.amount,
        decimals: row.original.decimals,
        symbol: row.original.symbol,
      }),
  }),
  columnHelper.accessor('from', {
    header: () => m.home_deposit_column_from(),
    cell: ({ row }) =>
      renderComponent(ExternalLinkCell, {
        href: row.original.fromUrl,
        text: shortAddress(row.original.from),
        label: m.home_view_on_etherscan(),
      }),
  }),
  columnHelper.display({
    id: 'chain',
    header: () => m.home_deposit_column_chain(),
    cell: () => m.home_chain_sepolia(),
  }),
  columnHelper.accessor('txHash', {
    header: () => m.home_deposit_column_tx(),
    cell: ({ row }) =>
      renderComponent(ExternalLinkCell, {
        href: row.original.txUrl,
        text: shortAddress(row.original.txHash),
        label: m.home_view_on_etherscan(),
      }),
  }),
])
