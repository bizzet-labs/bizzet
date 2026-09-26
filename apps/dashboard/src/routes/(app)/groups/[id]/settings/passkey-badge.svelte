<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'

let { hasPasskey }: { hasPasskey: boolean } = $props()
</script>

{#if hasPasskey}
	<Badge variant="secondary">{m.groups_candidate_passkey_ready()}</Badge>
{:else}
	<Badge variant="destructive">{m.groups_candidate_passkey_missing()}</Badge>
{/if}
