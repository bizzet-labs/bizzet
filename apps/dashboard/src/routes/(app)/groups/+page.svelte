<script lang="ts">
import StoreIcon from '@lucide/svelte/icons/store'
import DataTable from '@/components/data-table/data-table.svelte'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { m } from '$lib/paraglide/messages.js'
import { groupColumns } from './columns.js'

let { data } = $props()

const columns = $derived(groupColumns(data.canOpenSettings))
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex items-center justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold">{data.pageTitle}</h1>
			<p class="text-muted-foreground text-sm">{m.groups_list_description()}</p>
		</div>
		{#if data.canAddStore}
			<Button href="/groups/new">
				<StoreIcon data-icon="inline-start" />
				{m.groups_add_store()}
			</Button>
		{/if}
	</div>

	<Card.Root>
		<Card.Content>
			<DataTable {columns} data={data.groups} emptyMessage={m.groups_list_empty()} />
		</Card.Content>
	</Card.Root>
</main>
