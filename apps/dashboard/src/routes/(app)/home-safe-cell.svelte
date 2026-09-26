<script lang="ts">
import { Badge } from '@/components/ui/badge/index.js'
import { shortAddress } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'

let {
  groupId,
  safeAddress,
  isOwner,
}: { groupId: string; safeAddress: string | null; isOwner: boolean } = $props()
</script>

{#if safeAddress}
	<span class="font-mono text-xs">{shortAddress(safeAddress)}</span>
{:else}
	<div class="flex items-center gap-2">
		<Badge variant="secondary">{m.home_safe_not_configured()}</Badge>
		<!-- Safe の設定を確定できるのは Owner だけのため、ほかのロールには設定への導線を出さない -->
		{#if isOwner}
			<a
				href="/groups/{groupId}/settings"
				class="text-primary text-sm underline-offset-4 hover:underline"
			>
				{m.home_safe_configure()}
			</a>
		{/if}
	</div>
{/if}
