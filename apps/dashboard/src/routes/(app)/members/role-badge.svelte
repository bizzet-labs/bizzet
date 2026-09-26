<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'
import type { Role } from './columns.js'

let { role }: { role: Role } = $props()

const ROLE_LABELS = {
  owner: m.common_role_owner,
  approver: m.common_role_approver,
  viewer: m.common_role_viewer,
} as const
</script>

<Badge variant="secondary">{ROLE_LABELS[role]()}</Badge>
