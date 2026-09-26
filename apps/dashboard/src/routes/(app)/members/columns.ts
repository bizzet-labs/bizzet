import { createColumnHelper, renderComponent } from '@tanstack/svelte-table'
import type { DataTableFeatures } from '@/components/data-table/data-table-features.js'
import EmphasisCell from './emphasis-cell.svelte'
import LoginMethods from './login-methods.svelte'
import RevokeInvitationButton from './revoke-invitation-button.svelte'
import RoleBadge from './role-badge.svelte'

type Role = 'owner' | 'approver' | 'viewer'

export type MemberRow = {
  id: string
  email: string
  role: Role
  hasPassword: boolean
  hasPasskey: boolean
}

const memberColumnHelper = createColumnHelper<DataTableFeatures, MemberRow>()

export const memberColumns = memberColumnHelper.columns([
  memberColumnHelper.accessor('email', {
    header: 'メールアドレス',
    cell: ({ row }) =>
      renderComponent(EmphasisCell, { text: row.original.email }),
  }),
  memberColumnHelper.accessor('role', {
    header: 'ロール',
    cell: ({ row }) => renderComponent(RoleBadge, { role: row.original.role }),
  }),
  memberColumnHelper.display({
    id: 'loginMethod',
    header: 'ログイン手段',
    cell: ({ row }) => renderComponent(LoginMethods, { member: row.original }),
  }),
])

export type InvitationRow = {
  token: string
  email: string
  groupName: string
  role: Role
  expiresAt: string
}

const invitationColumnHelper = createColumnHelper<
  DataTableFeatures,
  InvitationRow
>()

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP')
}

export const invitationColumns = invitationColumnHelper.columns([
  invitationColumnHelper.accessor('email', {
    header: 'メールアドレス',
    cell: ({ row }) =>
      renderComponent(EmphasisCell, { text: row.original.email }),
  }),
  invitationColumnHelper.accessor('groupName', { header: 'グループ' }),
  invitationColumnHelper.accessor('role', {
    header: 'ロール',
    cell: ({ row }) => renderComponent(RoleBadge, { role: row.original.role }),
  }),
  invitationColumnHelper.accessor('expiresAt', {
    header: '期限',
    cell: ({ row }) => formatDate(row.original.expiresAt),
  }),
  invitationColumnHelper.display({
    id: 'actions',
    cell: ({ row }) =>
      renderComponent(RevokeInvitationButton, { token: row.original.token }),
  }),
])
