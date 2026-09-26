<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'
import type { GroupKind } from '$lib/roles'

let { id, name, kind }: { id: string; name: string; kind: GroupKind } = $props()

const kindLabel = $derived(
  kind === 'headquarters'
    ? m.common_group_kind_headquarters()
    : m.common_group_kind_store(),
)
</script>

<div class="flex items-center gap-2">
	<a href="/groups/{id}" class="font-medium underline-offset-4 hover:underline">{name}</a>
	<!-- 名前が種類と同じ（例：本部）なら、同じ言葉を2回並べない -->
	{#if name !== kindLabel}
		<Badge variant="outline">{kindLabel}</Badge>
	{/if}
</div>
