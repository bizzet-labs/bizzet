<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'
import type { MemberRow } from './columns.js'

let { member }: { member: MemberRow } = $props()
</script>

<div class="flex flex-wrap items-center gap-2">
	<!-- 名前が未入力のメンバーは、メールアドレスで呼ぶ -->
	<span class="font-medium">{member.name || member.email}</span>
	{#if member.isSelf}
		<Badge variant="outline">{m.members_you()}</Badge>
	{/if}
	{#if member.pendingOwnerChanges > 0}
		<Badge variant="secondary">
			{m.members_pending_owner_change({ count: member.pendingOwnerChanges })}
		</Badge>
	{/if}
</div>
