<script lang="ts" generics="TData extends RowData">
import {
  type ColumnDef,
  createTable,
  FlexRender,
  type RowData,
} from '@tanstack/svelte-table'
import * as Table from '@/components/ui/table/index.js'
import { type DataTableFeatures, features } from './data-table-features.js'

type DataTableProps<TData extends RowData> = {
  columns: ColumnDef<DataTableFeatures, TData>[]
  data: TData[]
  emptyMessage?: string
}

let {
  data,
  columns,
  emptyMessage = 'データがありません',
}: DataTableProps<TData> = $props()

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
			<Table.Row>
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
