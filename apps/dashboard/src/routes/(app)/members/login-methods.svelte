<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'

let {
  member,
}: {
  member: {
    role: 'owner' | 'approver' | 'viewer'
    hasPassword: boolean
    hasPasskey: boolean
  }
} = $props()

// Owner と Approver は Safe のオーナーになるため、パスキーの登録が要る
const needsPasskey = $derived(member.role !== 'viewer' && !member.hasPasskey)
</script>

<div class="flex flex-wrap gap-1">
	{#if member.hasPassword}
		<Badge variant="outline">パスワード</Badge>
	{/if}
	{#if member.hasPasskey}
		<Badge variant="outline">パスキー</Badge>
	{:else if needsPasskey}
		<Badge variant="destructive">パスキー未登録</Badge>
	{/if}
</div>
