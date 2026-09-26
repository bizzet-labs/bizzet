<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import type { SafeTransactionKind } from '$lib/server/transactions'
import { kindLabel } from './labels.js'

let { kind }: { kind: SafeTransactionKind } = $props()
</script>

<Badge variant="outline">{kindLabel(kind)}</Badge>
