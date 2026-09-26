<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'

let { status }: { status: 'unconfigured' | 'undeployed' | 'deployed' } =
  $props()
</script>

{#if status === 'deployed'}
	<Badge variant="secondary">{m.groups_safe_status_deployed()}</Badge>
{:else if status === 'undeployed'}
	<Badge variant="outline">{m.groups_safe_status_undeployed()}</Badge>
{:else}
	<Badge variant="outline" class="text-muted-foreground">{m.groups_safe_status_unconfigured()}</Badge>
{/if}
