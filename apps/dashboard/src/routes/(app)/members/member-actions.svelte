<script lang="ts">
import PencilIcon from '@lucide/svelte/icons/pencil'
import Trash2Icon from '@lucide/svelte/icons/trash-2'
import { Button } from '@/components/ui/button/index.js'
import { m } from '$lib/paraglide/messages.js'
import type { MemberRow } from './columns.js'

let {
  member,
  onEdit,
  onRemove,
}: {
  member: MemberRow
  onEdit: (member: MemberRow) => void
  onRemove: (member: MemberRow) => void
} = $props()
</script>

<div class="flex justify-end gap-1">
	<Button variant="ghost" size="icon-sm" aria-label={m.members_edit()} onclick={() => onEdit(member)}>
		<PencilIcon />
	</Button>
	<!-- 自分自身は外せない（別の Owner に任せる）。サーバーでも同じ規則で拒む -->
	{#if !member.isSelf}
		<Button
			variant="ghost"
			size="icon-sm"
			class="text-destructive"
			aria-label={m.members_remove()}
			onclick={() => onRemove(member)}
		>
			<Trash2Icon />
		</Button>
	{/if}
</div>
