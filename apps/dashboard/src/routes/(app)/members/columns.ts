import { createColumnHelper, renderComponent } from '@tanstack/svelte-table'
import type { DataTableFeatures } from '@/components/data-table/data-table-features.js'
import { formatDate } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import EmphasisCell from './emphasis-cell.svelte'
import InvitationKindBadge from './invitation-kind-badge.svelte'
import LoginMethods from './login-methods.svelte'
import MemberActions from './member-actions.svelte'
import MemberNameCell from './member-name-cell.svelte'
import RevokeInvitationButton from './revoke-invitation-button.svelte'
import RoleBadge from './role-badge.svelte'

export type Role = 'owner' | 'approver' | 'viewer'
export type GroupKind = 'headquarters' | 'store'
export type InvitationKind = 'member' | 'add_passkey' | 'add_password'

export type MemberRow = {
  id: string
  name: string | null
  title: string | null
  email: string
  groupId: string
  role: Role
  hasPassword: boolean
  hasPasskey: boolean
  pendingOwnerChanges: number
  isSelf: boolean
}

const memberColumnHelper = createColumnHelper<DataTableFeatures, MemberRow>()

// 見出しは表示のたびに訳すため、関数で渡す（モジュールの読み込み時の言語で固定しないように）
export function createMemberColumns(handlers: {
  onEdit: (member: MemberRow) => void
  onRemove: (member: MemberRow) => void
}) {
  return memberColumnHelper.columns([
    memberColumnHelper.display({
      id: 'name',
      header: () => m.members_column_name(),
      cell: ({ row }) =>
        renderComponent(MemberNameCell, { member: row.original }),
    }),
    memberColumnHelper.accessor('title', {
      header: () => m.members_column_title(),
      cell: ({ row }) => row.original.title ?? '',
    }),
    memberColumnHelper.accessor('email', {
      header: () => m.members_column_email(),
    }),
    memberColumnHelper.accessor('role', {
      header: () => m.members_column_role(),
      cell: ({ row }) =>
        renderComponent(RoleBadge, { role: row.original.role }),
    }),
    memberColumnHelper.display({
      id: 'loginMethod',
      header: () => m.members_column_login_methods(),
      cell: ({ row }) =>
        renderComponent(LoginMethods, { member: row.original }),
    }),
    memberColumnHelper.display({
      id: 'actions',
      cell: ({ row }) =>
        renderComponent(MemberActions, {
          member: row.original,
          onEdit: handlers.onEdit,
          onRemove: handlers.onRemove,
        }),
    }),
  ])
}

export type InvitationRow = {
  token: string
  kind: InvitationKind
  name: string | null
  email: string
  groupName: string
  role: Role
  expiresAt: string
}

const invitationColumnHelper = createColumnHelper<
  DataTableFeatures,
  InvitationRow
>()

export const invitationColumns = invitationColumnHelper.columns([
  invitationColumnHelper.accessor('email', {
    header: () => m.members_column_email(),
    cell: ({ row }) =>
      renderComponent(EmphasisCell, { text: row.original.email }),
  }),
  invitationColumnHelper.accessor('name', {
    header: () => m.members_column_name(),
    cell: ({ row }) => row.original.name ?? '',
  }),
  invitationColumnHelper.accessor('kind', {
    header: () => m.members_column_kind(),
    cell: ({ row }) =>
      renderComponent(InvitationKindBadge, { kind: row.original.kind }),
  }),
  invitationColumnHelper.accessor('groupName', {
    header: () => m.members_column_group(),
  }),
  invitationColumnHelper.accessor('role', {
    header: () => m.members_column_role(),
    cell: ({ row }) => renderComponent(RoleBadge, { role: row.original.role }),
  }),
  invitationColumnHelper.accessor('expiresAt', {
    header: () => m.members_column_expires(),
    cell: ({ row }) => formatDate(row.original.expiresAt),
  }),
  invitationColumnHelper.display({
    id: 'actions',
    cell: ({ row }) =>
      renderComponent(RevokeInvitationButton, { token: row.original.token }),
  }),
])
