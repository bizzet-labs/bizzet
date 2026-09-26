<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'

let { role }: { role: 'owner' | 'approver' | 'viewer' } = $props()

const ROLE_LABELS = {
  owner: 'Owner',
  approver: 'Approver',
  viewer: 'Viewer',
} as const
</script>

<Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
