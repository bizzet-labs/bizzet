<script lang="ts">
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import UserPlusIcon from '@lucide/svelte/icons/user-plus'
import DataTable from '@/components/data-table/data-table.svelte'
import * as Alert from '@/components/ui/alert/index.js'
import * as AlertDialog from '@/components/ui/alert-dialog/index.js'
import { Badge } from '@/components/ui/badge/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import * as Dialog from '@/components/ui/dialog/index.js'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'
import AssignmentFields from './assignment-fields.svelte'
import {
  createMemberColumns,
  invitationColumns,
  type MemberRow,
  type Role,
} from './columns.js'

let { data, form } = $props()

const KIND_LABELS = {
  headquarters: m.common_group_kind_headquarters,
  store: m.common_group_kind_store,
} as const

// 編集と削除の対象。ダイアログは1つずつ置き、行の操作から対象を差し替える
let editing = $state<MemberRow | null>(null)
let editOpen = $state(false)
let editGroupId = $state('')
let editRole = $state<Role>('viewer')
let editError = $state('')
let removing = $state<MemberRow | null>(null)
let removeOpen = $state(false)
let removeError = $state('')
let pending = $state(false)

const columns = createMemberColumns({
  onEdit: (member) => {
    editing = member
    editGroupId = member.groupId
    editRole = member.role
    editError = ''
    editOpen = true
  },
  onRemove: (member) => {
    removing = member
    removeError = ''
    removeOpen = true
  },
})

// 操作の結果。オーナーの変更の提案を作った場合は、承認が要ることを伝える
const notice = $derived.by(() => {
  if (!form || 'message' in form) return null
  if (form.action === 'update') {
    return form.proposalId
      ? m.members_updated_with_proposal()
      : m.members_updated()
  }
  if (form.action === 'remove') {
    return form.proposalId
      ? m.members_removed_with_proposal()
      : m.members_removed()
  }
  return null
})
const proposalId = $derived(
  form && 'proposalId' in form ? form.proposalId : null,
)
const revokeError = $derived(
  form?.action === 'revoke' && 'message' in form ? form.message : '',
)
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex items-center justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold">{m.common_nav_members()}</h1>
			<p class="text-muted-foreground text-sm">{m.members_list_description()}</p>
		</div>
		<Button href="/members/new">
			<UserPlusIcon data-icon="inline-start" />
			{m.members_invite_action()}
		</Button>
	</div>

	{#if notice}
		<Alert.Root>
			<CircleCheckIcon />
			<Alert.Title>{notice}</Alert.Title>
			{#if proposalId}
				<Alert.Description>
					<a href="/transactions/{proposalId}" class="underline underline-offset-4">
						{m.members_view_proposal()}
					</a>
				</Alert.Description>
			{/if}
		</Alert.Root>
	{/if}

	{#each data.groups as group (group.id)}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					{group.name}
					{#if group.name !== KIND_LABELS[group.kind]()}
						<Badge variant="outline">{KIND_LABELS[group.kind]()}</Badge>
					{/if}
				</Card.Title>
				<Card.Description>
					{m.members_group_count({ count: group.members.length })}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<DataTable {columns} data={group.members} emptyMessage={m.members_group_empty()} />
			</Card.Content>
		</Card.Root>
	{/each}

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.members_invitations_title()}</Card.Title>
			<Card.Description>{m.members_invitations_description()}</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			{#if revokeError}
				<Alert.Root variant="destructive">
					<CircleAlertIcon />
					<Alert.Title>{revokeError}</Alert.Title>
				</Alert.Root>
			{/if}
			<DataTable
				columns={invitationColumns}
				data={data.invitations}
				emptyMessage={m.members_invitations_empty()}
			/>
		</Card.Content>
	</Card.Root>
</main>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content>
		{#if editing}
			<Dialog.Header>
				<Dialog.Title>{m.members_edit_title()}</Dialog.Title>
				<Dialog.Description>{editing.email}</Dialog.Description>
			</Dialog.Header>
			<form
				method="POST"
				action="?/update"
				class="flex flex-col gap-6"
				use:enhance={() => {
					pending = true
					return async ({ result, update }) => {
						pending = false
						if (result.type === 'failure') {
							editError = (result.data?.message as string | undefined) ?? ''
							return
						}
						editOpen = false
						await update()
					}
				}}
			>
				<input type="hidden" name="memberId" value={editing.id} />
				<FieldGroup>
					<Field>
						<FieldLabel for="edit-name">{m.members_field_name()}</FieldLabel>
						<Input id="edit-name" name="name" value={editing.name ?? ''} />
					</Field>
					<Field>
						<FieldLabel for="edit-title">{m.members_field_title()}</FieldLabel>
						<Input
							id="edit-title"
							name="title"
							value={editing.title ?? ''}
							placeholder={m.members_field_title_placeholder()}
						/>
					</Field>
					<AssignmentFields
						groups={data.groupOptions}
						bind:groupId={editGroupId}
						bind:role={editRole}
						disabled={editing.isSelf}
						idPrefix="edit"
					/>
					{#if editing.isSelf}
						<p class="text-muted-foreground text-sm">{m.members_edit_self_hint()}</p>
					{/if}
					{#if editError}
						<p class="text-destructive text-sm">{editError}</p>
					{/if}
				</FieldGroup>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (editOpen = false)}>
						{m.common_cancel()}
					</Button>
					<Button type="submit" disabled={pending}>{m.common_save()}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={removeOpen}>
	<AlertDialog.Content>
		{#if removing}
			<AlertDialog.Header>
				<AlertDialog.Title>
					{m.members_remove_title({ member: removing.name || removing.email })}
				</AlertDialog.Title>
				<AlertDialog.Description>{m.members_remove_description()}</AlertDialog.Description>
			</AlertDialog.Header>
			{#if removeError}
				<p class="text-destructive text-sm">{removeError}</p>
			{/if}
			<form
				method="POST"
				action="?/remove"
				use:enhance={() => {
					pending = true
					return async ({ result, update }) => {
						pending = false
						if (result.type === 'failure') {
							removeError = (result.data?.message as string | undefined) ?? ''
							return
						}
						removeOpen = false
						await update()
					}
				}}
			>
				<input type="hidden" name="memberId" value={removing.id} />
				<AlertDialog.Footer>
					<AlertDialog.Cancel type="button">{m.common_cancel()}</AlertDialog.Cancel>
					<Button type="submit" variant="destructive" disabled={pending}>
						{m.members_remove()}
					</Button>
				</AlertDialog.Footer>
			</form>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>
