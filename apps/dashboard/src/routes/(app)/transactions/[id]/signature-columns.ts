import { createColumnHelper, renderComponent } from '@tanstack/svelte-table'
import type { DataTableFeatures } from '@/components/data-table/data-table-features.js'
import { formatDateTime } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import MonoCell from '../mono-cell.svelte'

export type SignatureRow = {
  id: string
  memberLabel: string
  signer: string
  createdAt: string
}

const columnHelper = createColumnHelper<DataTableFeatures, SignatureRow>()

export const signatureColumns = columnHelper.columns([
  columnHelper.accessor('memberLabel', {
    header: () => m.transactions_signature_member(),
  }),
  columnHelper.accessor('signer', {
    header: () => m.transactions_signature_signer(),
    // 署名者のアドレスは照合に使うため、縮めずに出す
    cell: ({ row }) => renderComponent(MonoCell, { text: row.original.signer }),
  }),
  columnHelper.accessor('createdAt', {
    header: () => m.transactions_signature_created_at(),
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  }),
])
