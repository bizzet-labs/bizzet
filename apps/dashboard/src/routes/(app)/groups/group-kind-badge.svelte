<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'
import type { GroupKind } from '$lib/roles'

let { kind }: { kind: GroupKind } = $props()
</script>

<Badge variant="outline">
	{kind === 'headquarters' ? m.common_group_kind_headquarters() : m.common_group_kind_store()}
</Badge>
