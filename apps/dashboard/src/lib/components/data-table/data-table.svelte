<script lang="ts" generics="TData extends RowData">
import {
  type ColumnDef,
  createTable,
  FlexRender,
  type RowData,
} from '@tanstack/svelte-table'
import * as Table from '@/components/ui/table/index.js'
import { goto } from '$app/navigation'
import { m } from '$lib/paraglide/messages.js'
import { type DataTableFeatures, features } from './data-table-features.js'

type DataTableProps<TData extends RowData> = {
  columns: ColumnDef<DataTableFeatures, TData>[]
  data: TData[]
  emptyMessage?: string
  // 指定すると、行のどこを押してもその行の詳細へ移れる
  rowHref?: (row: TData) => string
}

let {
  data,
  columns,
  emptyMessage = m.common_no_data(),
  rowHref,
}: DataTableProps<TData> = $props()

// 行の中のリンクやボタンを押したときは、その操作を優先して行の移動はしない
function handleRowClick(event: MouseEvent, row: TData) {
  if (!rowHref) return
  if (
    (event.target as HTMLElement).closest('a, button, input, select, textarea')
  )
    return
  goto(rowHref(row))
}

const table = createTable({
  features,
  get data() {
    return data
  },
  get columns() {
    return columns
  },
})
</script>

<Table.Root>
	<Table.Header>
		{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
			<Table.Row>
				{#each headerGroup.headers as header (header.id)}
					<Table.Head colspan={header.colSpan}>
						{#if !header.isPlaceholder}
							<FlexRender {header} />
						{/if}
					</Table.Head>
				{/each}
			</Table.Row>
		{/each}
	</Table.Header>
	<Table.Body>
		{#each table.getRowModel().rows as row (row.id)}
			<Table.Row
				class={rowHref ? 'cursor-pointer' : undefined}
				onclick={rowHref ? (event) => handleRowClick(event, row.original) : undefined}
			>
				{#each row.getAllCells() as cell (cell.id)}
					<Table.Cell>
						<FlexRender {cell} />
					</Table.Cell>
				{/each}
			</Table.Row>
		{:else}
			<Table.Row>
				<Table.Cell colspan={columns.length} class="text-muted-foreground h-16 text-center">
					{emptyMessage}
				</Table.Cell>
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
