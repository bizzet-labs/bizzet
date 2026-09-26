<script lang="ts">
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
import SettingsIcon from '@lucide/svelte/icons/settings'
import WalletIcon from '@lucide/svelte/icons/wallet'
import DataTable from '@/components/data-table/data-table.svelte'
import * as Alert from '@/components/ui/alert/index.js'
import { Badge } from '@/components/ui/badge/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import * as Empty from '@/components/ui/empty/index.js'
import { formatTokenAmount } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import { depositColumns } from './columns.js'

let { data } = $props()

const kindLabel = $derived(
  data.group.kind === 'headquarters'
    ? m.common_group_kind_headquarters()
    : m.common_group_kind_store(),
)
</script>

<svelte:head>
	<title>{m.common_title({ page: data.group.name })}</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex items-center justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="flex items-center gap-2 text-2xl font-bold">
				{data.group.name}
				<!-- 名前が種類と同じ（例：本部）なら、同じ言葉を2回並べない -->
				{#if data.group.name !== kindLabel}
					<Badge variant="outline">{kindLabel}</Badge>
				{/if}
			</h1>
			<p class="text-muted-foreground text-sm">{m.home_group_description()}</p>
		</div>
		<!-- Safe の設定を扱えるのは Owner だけ -->
		{#if data.isOwner}
			<Button href="/groups/{data.group.id}/settings" variant="outline">
				<SettingsIcon data-icon="inline-start" />
				{m.home_group_settings()}
			</Button>
		{/if}
	</div>

	{#if data.group.safeAddress === null}
		<Card.Root>
			<Card.Content>
				<Empty.Root>
					<Empty.Header>
						<Empty.Media variant="icon">
							<WalletIcon />
						</Empty.Media>
						<Empty.Title>{m.home_safe_not_configured()}</Empty.Title>
						<Empty.Description>{m.home_group_safe_not_configured_description()}</Empty.Description>
					</Empty.Header>
					{#if data.isOwner}
						<Empty.Content>
							<Button href="/groups/{data.group.id}/settings">{m.home_safe_configure()}</Button>
						</Empty.Content>
					{/if}
				</Empty.Root>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.home_group_safe_title()}</Card.Title>
				</Card.Header>
				<Card.Content>
					<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
						<dt class="text-muted-foreground">{m.home_group_safe_address()}</dt>
						<dd class="min-w-0">
							<a
								href={data.group.safeUrl}
								target="_blank"
								rel="noopener noreferrer"
								title={m.home_view_on_etherscan()}
								class="inline-flex items-center gap-1 font-mono text-xs break-all underline-offset-4 hover:underline"
							>
								{data.group.safeAddress}
								<ExternalLinkIcon class="size-3 shrink-0" />
							</a>
						</dd>
						<dt class="text-muted-foreground">{m.home_group_safe_state()}</dt>
						<dd>
							{#if data.group.deployed === true}
								<Badge variant="secondary">{m.home_group_safe_deployed()}</Badge>
							{:else if data.group.deployed === false}
								<Badge variant="outline">{m.home_group_safe_not_deployed()}</Badge>
							{:else}
								<span class="text-muted-foreground">{m.home_group_safe_state_unknown()}</span>
							{/if}
						</dd>
					</dl>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>{m.home_group_balances_title()}</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if data.balances === null}
						<Alert.Root variant="destructive">
							<CircleAlertIcon />
							<Alert.Title>{m.home_balance_error_title()}</Alert.Title>
							<Alert.Description>{m.home_balance_error_description()}</Alert.Description>
						</Alert.Root>
					{:else if data.balances}
						<dl class="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3">
							{#each data.balances as balance (balance.symbol)}
								<dt class="text-muted-foreground text-sm">{balance.symbol}</dt>
								<dd class="text-xl font-semibold tabular-nums">
									{balance.amount === null
										? '—'
										: formatTokenAmount(balance.amount, balance.decimals)}
								</dd>
							{/each}
						</dl>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>{m.home_group_deposits_title()}</Card.Title>
				<Card.Description>
					{m.home_group_deposits_description({ limit: data.depositLimit })}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<DataTable
					columns={depositColumns}
					data={data.deposits}
					emptyMessage={m.home_group_deposits_empty()}
				/>
			</Card.Content>
		</Card.Root>
	{/if}
</main>
