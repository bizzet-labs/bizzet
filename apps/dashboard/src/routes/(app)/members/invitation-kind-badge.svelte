<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { m } from '$lib/paraglide/messages.js'
import type { InvitationKind } from './columns.js'

let { kind }: { kind: InvitationKind } = $props()

const KIND_LABELS = {
  member: m.members_invitation_kind_member,
  add_passkey: m.members_invitation_kind_add_passkey,
  add_password: m.members_invitation_kind_add_password,
} as const
</script>

<Badge variant={kind === 'member' ? 'secondary' : 'outline'}>{KIND_LABELS[kind]()}</Badge>
