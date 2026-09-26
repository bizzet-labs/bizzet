<script lang="ts">
import PlusIcon from '@lucide/svelte/icons/plus'
import ReceiptIcon from '@lucide/svelte/icons/receipt'
import DataTable from '@/components/data-table/data-table.svelte'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import * as Empty from '@/components/ui/empty/index.js'
import * as Tabs from '@/components/ui/tabs/index.js'
import { m } from '$lib/paraglide/messages.js'
import { transactionColumns } from './columns.js'

let { data } = $props()

const columns = $derived(transactionColumns(data.required))
const hasAny = $derived(data.inProgress.length + data.completed.length > 0)
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex items-center justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold">{m.transactions_title()}</h1>
			<p class="text-muted-foreground text-sm">{m.transactions_description()}</p>
		</div>
		{#if data.canCreate}
			<Button href="/transactions/new">
				<PlusIcon data-icon="inline-start" />
				{m.transactions_new_payout()}
			</Button>
		{/if}
	</div>

	{#if hasAny}
		<Tabs.Root value="in_progress">
			<Tabs.List>
				<Tabs.Trigger value="in_progress">
					{m.transactions_tab_in_progress()} ({data.inProgress.length})
				</Tabs.Trigger>
				<Tabs.Trigger value="completed">
					{m.transactions_tab_completed()} ({data.completed.length})
				</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="in_progress">
				<Card.Root>
					<Card.Content>
						<DataTable
							{columns}
							data={data.inProgress}
							rowHref={(row) => `/transactions/${row.id}`}
							emptyMessage={m.transactions_empty_in_progress()}
						/>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
			<Tabs.Content value="completed">
				<Card.Root>
					<Card.Content>
						<DataTable
							{columns}
							data={data.completed}
							rowHref={(row) => `/transactions/${row.id}`}
							emptyMessage={m.transactions_empty_completed()}
						/>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	{:else}
		<Empty.Root class="border">
			<Empty.Header>
				<Empty.Media variant="icon">
					<ReceiptIcon />
				</Empty.Media>
				<Empty.Title>{m.transactions_empty_title()}</Empty.Title>
				<Empty.Description>{m.transactions_empty_description()}</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{/if}
</main>
