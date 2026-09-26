<script lang="ts">
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field/index.js'
import * as Select from '@/components/ui/select/index.js'
import { m } from '$lib/paraglide/messages.js'
import type { GroupKind, Role } from '$lib/roles'

// 招待とメンバーの編集で共通の、グループとロールの選択。
// 店舗のグループには Viewer しか割り当てられないため、店舗を選んだら Viewer に固定する
let {
  groups,
  groupId = $bindable(),
  role = $bindable(),
  disabled = false,
  idPrefix,
}: {
  groups: { id: string; name: string; kind: GroupKind }[]
  groupId: string
  role: Role
  disabled?: boolean
  idPrefix: string
} = $props()

const ROLE_OPTIONS = [
  { value: 'viewer', label: m.common_role_viewer },
  { value: 'approver', label: m.common_role_approver },
  { value: 'owner', label: m.common_role_owner },
] as const

const selectedGroup = $derived(groups.find((g) => g.id === groupId))
const isStore = $derived(selectedGroup?.kind === 'store')
const roleLabel = $derived(
  ROLE_OPTIONS.find((o) => o.value === role)?.label() ?? '',
)

$effect(() => {
  if (isStore && role !== 'viewer') role = 'viewer'
})
</script>

<!-- 選択を無効にしたときも値を送れるよう、送信用の値は hidden の input で持つ -->
<input type="hidden" name="groupId" value={groupId} />
<input type="hidden" name="role" value={role} />

<Field>
	<FieldLabel for="{idPrefix}-group">{m.members_field_group()}</FieldLabel>
	<Select.Root type="single" bind:value={groupId} {disabled}>
		<Select.Trigger id="{idPrefix}-group" class="w-full">
			{selectedGroup?.name ?? m.members_field_group_placeholder()}
		</Select.Trigger>
		<Select.Content>
			{#each groups as group (group.id)}
				<Select.Item value={group.id} label={group.name} />
			{/each}
		</Select.Content>
	</Select.Root>
</Field>
<Field>
	<FieldLabel for="{idPrefix}-role">{m.members_field_role()}</FieldLabel>
	<Select.Root
		type="single"
		value={role}
		onValueChange={(value) => {
			role = value as Role
		}}
		disabled={disabled || isStore}
	>
		<Select.Trigger id="{idPrefix}-role" class="w-full">{roleLabel}</Select.Trigger>
		<Select.Content>
			{#each ROLE_OPTIONS as option (option.value)}
				<Select.Item value={option.value} label={option.label()} />
			{/each}
		</Select.Content>
	</Select.Root>
	{#if isStore}
		<FieldDescription>{m.members_field_role_store_hint()}</FieldDescription>
	{:else if role !== 'viewer'}
		<FieldDescription>{m.members_field_role_signer_hint()}</FieldDescription>
	{/if}
</Field>
