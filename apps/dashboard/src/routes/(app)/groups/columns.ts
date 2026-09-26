import { createColumnHelper, renderComponent } from '@tanstack/svelte-table'
import type { DataTableFeatures } from '@/components/data-table/data-table-features.js'
import { m } from '$lib/paraglide/messages.js'
import type { GroupKind } from '$lib/roles'
import GroupKindBadge from './group-kind-badge.svelte'
import GroupNameCell from './group-name-cell.svelte'
import SafeStatusBadge from './safe-status-badge.svelte'
import SettingsLinkCell from './settings-link-cell.svelte'

export type GroupRow = {
  id: string
  name: string
  kind: GroupKind
  safeStatus: 'unconfigured' | 'undeployed' | 'deployed'
  memberCount: number
}

const columnHelper = createColumnHelper<DataTableFeatures, GroupRow>()

// 見出しは表示のたびに訳すため、文字列ではなく関数で渡す
const allColumns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: () => m.groups_column_name(),
    cell: ({ row }) =>
      renderComponent(GroupNameCell, {
        id: row.original.id,
        name: row.original.name,
      }),
  }),
  columnHelper.accessor('kind', {
    header: () => m.groups_column_kind(),
    cell: ({ row }) =>
      renderComponent(GroupKindBadge, { kind: row.original.kind }),
  }),
  columnHelper.accessor('safeStatus', {
    header: () => m.groups_column_safe(),
    cell: ({ row }) =>
      renderComponent(SafeStatusBadge, { status: row.original.safeStatus }),
  }),
  columnHelper.accessor('memberCount', {
    header: () => m.groups_column_members(),
    cell: ({ row }) => row.original.memberCount.toString(),
  }),
  columnHelper.display({
    id: 'settings',
    cell: ({ row }) =>
      renderComponent(SettingsLinkCell, { id: row.original.id }),
  }),
])

// 設定画面への列（最後の列）は、Owner にだけ出す
export function groupColumns(canOpenSettings: boolean) {
  return canOpenSettings ? allColumns : allColumns.slice(0, -1)
}
