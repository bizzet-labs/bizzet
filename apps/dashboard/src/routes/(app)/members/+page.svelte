<script lang="ts">
import UserPlusIcon from '@lucide/svelte/icons/user-plus'
import DataTable from '@/components/data-table/data-table.svelte'
import { Badge } from '@/components/ui/badge/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { invitationColumns, memberColumns } from './columns.js'

let { data, form } = $props()

const KIND_LABELS = { headquarters: '本部', store: '店舗' } as const
</script>

<svelte:head>
	<title>メンバー | bizzet</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex items-center justify-between">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold">メンバー</h1>
			<p class="text-muted-foreground text-sm">
				グループごとのメンバーと、未使用の招待を確認します
			</p>
		</div>
		<Button href="/members/new">
			<UserPlusIcon data-icon="inline-start" />
			メンバーを招待
		</Button>
	</div>

	{#each data.groups as group (group.id)}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					{group.name}
					{#if group.name !== KIND_LABELS[group.kind]}
						<Badge variant="outline">{KIND_LABELS[group.kind]}</Badge>
					{/if}
				</Card.Title>
				<Card.Description>{group.members.length} 人</Card.Description>
			</Card.Header>
			<Card.Content>
				<DataTable
					columns={memberColumns}
					data={group.members}
					emptyMessage="メンバーはまだいません"
				/>
			</Card.Content>
		</Card.Root>
	{/each}

	<Card.Root>
		<Card.Header>
			<Card.Title>未使用の招待</Card.Title>
			<Card.Description>期限内で、まだ使われていない招待です</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			{#if form?.message}
				<p class="text-destructive text-sm">{form.message}</p>
			{/if}
			<DataTable
				columns={invitationColumns}
				data={data.invitations}
				emptyMessage="未使用の招待はありません"
			/>
		</Card.Content>
	</Card.Root>
</main>
