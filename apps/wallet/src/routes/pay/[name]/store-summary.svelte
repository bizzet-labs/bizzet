<script lang="ts">
import type { ReceivingCurrency, ResolvedGroupName } from '@bizzet/contracts'
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle'
import StoreIcon from '@lucide/svelte/icons/store'
import { explorerAddressUrl, shortAddress } from '@/format.js'

// ENS で解決した支払い先の店の名前・受取先・受取通貨
let {
  resolving,
  name,
  resolved,
  recipient,
  currency,
  mocked,
}: {
  resolving: boolean
  name: string
  resolved: ResolvedGroupName | null
  recipient: string | null
  currency: ReceivingCurrency | null
  mocked: boolean
} = $props()
</script>

<div class="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
	<StoreIcon class="text-muted-foreground mt-0.5 size-5" />
	<div class="flex min-w-0 flex-1 flex-col gap-0.5">
		{#if resolving}
			<span class="text-muted-foreground flex items-center gap-2 text-sm">
				<LoaderCircleIcon class="size-4 animate-spin" />
				{name} を ENS で解決しています
			</span>
		{:else}
			<span class="font-medium">{resolved?.description ?? name}</span>
			<span class="font-mono text-xs">{name}</span>
			{#if recipient}
				<a
					href={explorerAddressUrl(recipient)}
					target="_blank"
					rel="noreferrer"
					class="text-muted-foreground inline-flex items-center gap-1 font-mono text-xs hover:underline"
				>
					受取先 {shortAddress(recipient)}
					<ExternalLinkIcon class="size-3" />
				</a>
			{/if}
			{#if currency}
				<span class="text-muted-foreground text-xs">受取通貨 {currency}</span>
			{/if}
			{#if mocked}
				<span class="mt-1 self-start rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
					開発用のモック（ENS で解決していません）
				</span>
			{/if}
		{/if}
	</div>
</div>
