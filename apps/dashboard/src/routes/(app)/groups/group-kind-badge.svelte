<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'

let { kind }: { kind: 'headquarters' | 'store' } = $props()
</script>

<Badge variant="outline">
	{kind === 'headquarters' ? m.common_group_kind_headquarters() : m.common_group_kind_store()}
</Badge>
