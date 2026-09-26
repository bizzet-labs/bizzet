<script lang="ts">
import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
import * as Alert from '@/components/ui/alert/index.js'
import { m } from '$lib/paraglide/messages.js'

// Universal Resolver で解決した値。データベースの値ではなく、ENS に書かれた値を出す
let {
  view,
}: {
  view: {
    name: string
    resolved: { address: string | null; currency: string | null } | null
    mismatch: boolean
  }
} = $props()
</script>

<div class="flex flex-col gap-3">
	<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
		<dt class="text-muted-foreground">{m.groups_ens_resolved_address()}</dt>
		<dd class="font-mono text-xs break-all">
			{view.resolved === null ? m.groups_ens_resolve_failed() : (view.resolved.address ?? '—')}
		</dd>
		<dt class="text-muted-foreground">{m.groups_ens_resolved_currency()}</dt>
		<dd>{view.resolved?.currency ?? '—'}</dd>
	</dl>
	{#if view.mismatch}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{m.groups_ens_mismatch_title()}</Alert.Title>
			<Alert.Description>{m.groups_ens_mismatch_description()}</Alert.Description>
		</Alert.Root>
	{/if}
</div>
