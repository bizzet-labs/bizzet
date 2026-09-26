<script lang="ts">
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
import DataTable from '@/components/data-table/data-table.svelte'
import * as Alert from '@/components/ui/alert/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { formatTokenAmount } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import { createHomeGroupColumns } from './home-columns.js'

let { data } = $props()

const columns = $derived(createHomeGroupColumns(data.tokens, data.isOwner))
</script>

<svelte:head>
	<title>{m.common_title({ page: m.common_nav_home() })}</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-bold">{m.common_nav_home()}</h1>
		<p class="text-muted-foreground text-sm">{m.home_description()}</p>
	</div>

	{#if data.balanceError}
		<Alert.Root variant="destructive">
			<CircleAlertIcon />
			<Alert.Title>{m.home_balance_error_title()}</Alert.Title>
			<Alert.Description>{m.home_balance_error_description()}</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.totals as total (total.symbol)}
			<Card.Root>
				<Card.Header>
					<Card.Description>{m.home_total_title({ token: total.symbol })}</Card.Description>
					<Card.Title class="text-2xl tabular-nums">
						{total.amount === null ? '—' : formatTokenAmount(total.amount, total.decimals)}
						<span class="text-muted-foreground text-sm font-normal">{total.symbol}</span>
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="text-muted-foreground text-xs">{m.home_total_description()}</p>
				</Card.Content>
			</Card.Root>
		{/each}

		{#if data.pendingCount !== null}
			<Card.Root>
				<Card.Header>
					<Card.Description>{m.home_pending_title()}</Card.Description>
					<Card.Title class="text-2xl tabular-nums">
						{m.home_pending_count({ count: data.pendingCount })}
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<Button href="/transactions" variant="outline" size="sm">
						{m.home_pending_link()}
					</Button>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.home_groups_title()}</Card.Title>
			<Card.Description>{m.home_groups_description()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<DataTable {columns} data={data.groups} emptyMessage={m.home_groups_empty()} />
		</Card.Content>
	</Card.Root>
</main>
