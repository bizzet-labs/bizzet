import { createColumnHelper, renderComponent } from '@tanstack/svelte-table'
import type { DataTableFeatures } from '@/components/data-table/data-table-features.js'
import { m } from '$lib/paraglide/messages.js'
import type { Role } from '$lib/roles'
import CandidateSelectCell from './candidate-select-cell.svelte'
import MemberCell from './member-cell.svelte'
import PasskeyBadge from './passkey-badge.svelte'

export type CandidateRow = {
  id: string
  label: string
  email: string
  role: Role
  hasPasskey: boolean
}

const columnHelper = createColumnHelper<DataTableFeatures, CandidateRow>()

const ROLE_LABELS = {
  owner: () => m.common_role_owner(),
  approver: () => m.common_role_approver(),
  viewer: () => m.common_role_viewer(),
} as const

// 見出しは表示のたびに訳すため、文字列ではなく関数で渡す。
// 選択の列（先頭の列）は、確定できる Owner にだけ出す
export function candidateColumns(formId: string, selectable: boolean) {
  const columns = columnHelper.columns([
    columnHelper.display({
      id: 'select',
      header: () => m.groups_candidate_column_select(),
      cell: ({ row }) =>
        renderComponent(CandidateSelectCell, {
          id: row.original.id,
          label: row.original.label,
          formId,
          disabled: !row.original.hasPasskey,
        }),
    }),
    columnHelper.accessor('label', {
      header: () => m.groups_candidate_column_member(),
      cell: ({ row }) =>
        renderComponent(MemberCell, {
          label: row.original.label,
          email: row.original.email,
        }),
    }),
    columnHelper.accessor('role', {
      header: () => m.groups_candidate_column_role(),
      cell: ({ row }) => ROLE_LABELS[row.original.role](),
    }),
    columnHelper.accessor('hasPasskey', {
      header: () => m.groups_candidate_column_passkey(),
      cell: ({ row }) =>
        renderComponent(PasskeyBadge, { hasPasskey: row.original.hasPasskey }),
    }),
  ])
  return selectable ? columns : columns.slice(1)
}
