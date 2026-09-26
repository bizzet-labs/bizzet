<script lang="ts">
import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
import { m } from '$lib/paraglide/messages.js'
import EnsStatusBadge from './ens-status-badge.svelte'

let {
  name,
  status,
  mismatch,
}: {
  name: string | null
  status: 'unregistered' | 'registered' | 'failed'
  mismatch: boolean
} = $props()
</script>

{#if name}
	<span class="inline-flex items-center gap-2">
		<span class="font-mono text-xs">{name}</span>
		{#if status !== 'registered'}
			<EnsStatusBadge {status} />
		{/if}
		{#if mismatch}
			<span class="text-destructive" title={m.groups_ens_mismatch_title()}>
				<TriangleAlertIcon class="size-4" />
			</span>
		{/if}
	</span>
{:else}
	<span class="text-muted-foreground">—</span>
{/if}
