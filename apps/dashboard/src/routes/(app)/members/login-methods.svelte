<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'
import type { Role } from './columns.js'

let {
  member,
}: {
  member: { role: Role; hasPassword: boolean; hasPasskey: boolean }
} = $props()

// Owner と Approver は Safe のオーナーになるため、パスキーの登録が要る
const needsPasskey = $derived(member.role !== 'viewer' && !member.hasPasskey)
</script>

<div class="flex flex-wrap gap-1">
	{#if member.hasPassword}
		<Badge variant="outline">{m.members_login_password()}</Badge>
	{/if}
	{#if member.hasPasskey}
		<Badge variant="outline">{m.members_login_passkey()}</Badge>
	{:else if needsPasskey}
		<Badge variant="destructive">{m.members_login_passkey_missing()}</Badge>
	{/if}
</div>
