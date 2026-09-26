<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import type { DisplayStatus } from '$lib/server/transactions'
import { statusLabel, statusVariant } from './labels.js'

let { status }: { status: DisplayStatus } = $props()
</script>

<Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
