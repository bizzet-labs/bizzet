<script lang="ts">
import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
import * as Card from '@/components/ui/card/index.js'
import * as Empty from '@/components/ui/empty/index.js'
import { m } from '$lib/paraglide/messages.js'

let { data } = $props()
</script>

<svelte:head>
	<title>{m.common_title({ page: m.common_nav_bridge() })}</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-bold">{m.common_nav_bridge()}</h1>
		<p class="text-muted-foreground text-sm">{m.bridge_description()}</p>
	</div>

	<!-- 移動中の売上があるときの一覧（送り元のチェーン・金額・着金日時・到着の見込み）は、
	     自動ブリッジを有効にする時点で DataTable としてここに加える -->
	{#if data.transfers.length === 0}
		<Card.Root>
			<Card.Content>
				<Empty.Root>
					<Empty.Header>
						<Empty.Media variant="icon">
							<ArrowLeftRightIcon />
						</Empty.Media>
						<Empty.Title>{m.bridge_empty_title()}</Empty.Title>
						<Empty.Description>{m.bridge_empty_description()}</Empty.Description>
					</Empty.Header>
				</Empty.Root>
			</Card.Content>
		</Card.Root>
	{/if}
</main>
