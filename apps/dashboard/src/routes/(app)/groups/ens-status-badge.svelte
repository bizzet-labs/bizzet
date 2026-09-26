<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'

let { status }: { status: 'unregistered' | 'registered' | 'failed' } = $props()
</script>

{#if status === 'registered'}
	<Badge variant="secondary">{m.groups_ens_status_registered()}</Badge>
{:else if status === 'failed'}
	<Badge variant="destructive">{m.groups_ens_status_failed()}</Badge>
{:else}
	<Badge variant="outline" class="text-muted-foreground">{m.groups_ens_status_unregistered()}</Badge>
{/if}
