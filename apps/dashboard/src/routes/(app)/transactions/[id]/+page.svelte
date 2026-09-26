<script lang="ts">
import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
import InfoIcon from '@lucide/svelte/icons/info'
import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
import type { Snippet } from 'svelte'
import { sepolia } from 'viem/chains'
import DataTable from '@/components/data-table/data-table.svelte'
import * as Alert from '@/components/ui/alert/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import * as Collapsible from '@/components/ui/collapsible/index.js'
import { formatDateTime, formatTokenAmount } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import KindBadge from '../kind-badge.svelte'
import { approvalsLabel } from '../labels.js'
import StatusBadge from '../status-badge.svelte'
import RejectButton from './reject-button.svelte'
import { signatureColumns } from './signature-columns.js'

let { data, form } = $props()

const tx = $derived(data.transaction)
const explorer = sepolia.blockExplorers.default.url
let dataOpen = $state(false)
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

{#snippet item(label: string, value: Snippet)}
	<div class="grid gap-1 sm:grid-cols-[14rem_1fr] sm:gap-4">
		<dt class="text-muted-foreground text-sm">{label}</dt>
		<dd class="min-w-0 text-sm break-all">{@render value()}</dd>
	</div>
{/snippet}

{#snippet mono(text: string)}
	<span class="font-mono text-xs">{text}</span>
{/snippet}

{#snippet explorerLink(path: string, text: string)}
	<a
		href={`${explorer}/${path}`}
		target="_blank"
		rel="noreferrer"
		class="inline-flex items-center gap-1 font-mono text-xs underline-offset-4 hover:underline"
		title={m.transactions_view_on_explorer()}
	>
		{text}
		<ExternalLinkIcon class="size-3 shrink-0" />
	</a>
{/snippet}

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex flex-col gap-3">
		<a
			href="/transactions"
			class="text-muted-foreground inline-flex w-fit items-center gap-1 text-sm hover:underline"
		>
			<ArrowLeftIcon class="size-4" />
			{m.transactions_back_to_list()}
		</a>
		<div class="flex items-center justify-between gap-4">
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="text-2xl font-bold">{m.transactions_detail_title()}</h1>
				<KindBadge kind={tx.kind} />
				<StatusBadge status={tx.status} />
			</div>
			{#if data.canReject}
				<RejectButton laterOpenCount={data.laterOpenCount} />
			{/if}
		</div>
	</div>

	{#if form?.message}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Description>{form.message}</Alert.Description>
		</Alert.Root>
	{/if}

	{#if tx.status === 'rejected' && data.laterOpenCount > 0}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{m.transactions_rejected_later_warning_title()}</Alert.Title>
			<Alert.Description>
				{m.transactions_rejected_later_warning({ count: data.laterOpenCount })}
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if tx.status === 'requested' || tx.status === 'awaiting_approval'}
		<Alert.Root>
			<InfoIcon />
			<Alert.Title>{m.transactions_wallet_alert_title()}</Alert.Title>
			<Alert.Description>{m.transactions_wallet_alert_description()}</Alert.Description>
		</Alert.Root>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.transactions_section_content()}</Card.Title>
		</Card.Header>
		<Card.Content>
			<dl class="flex flex-col gap-3">
				{#snippet group()}{tx.groupName}{/snippet}
				{@render item(m.transactions_field_group(), group)}
				{#snippet safe()}{@render explorerLink(`address/${tx.safeAddress}`, tx.safeAddress)}{/snippet}
				{@render item(m.transactions_field_safe(), safe)}
				{#if tx.kind === 'payout'}
					{#snippet amount()}
						{#if tx.token && tx.amount}
							{m.transactions_amount({
								amount: formatTokenAmount(tx.amount, tx.token.decimals),
								symbol: tx.token.symbol,
							})}
						{:else}
							{tx.amount ?? ''}
						{/if}
					{/snippet}
					{@render item(m.transactions_field_amount(), amount)}
					{#snippet recipient()}
						{#if tx.recipient}
							{@render explorerLink(`address/${tx.recipient}`, tx.recipient)}
						{/if}
					{/snippet}
					{@render item(m.transactions_field_recipient(), recipient)}
				{/if}
				{#if tx.targetMember}
					{#snippet target()}{tx.targetMember}{/snippet}
					{@render item(m.transactions_field_target_member(), target)}
				{/if}
				{#if tx.description}
					{#snippet description()}{tx.description}{/snippet}
					{@render item(m.transactions_field_description(), description)}
				{/if}
				{#snippet creator()}{tx.creator}{/snippet}
				{@render item(m.transactions_field_creator(), creator)}
				{#snippet createdAt()}{formatDateTime(tx.createdAt)}{/snippet}
				{@render item(m.transactions_field_created_at(), createdAt)}
				{#if tx.executedAt}
					{#snippet executedAt()}{formatDateTime(tx.executedAt ?? '')}{/snippet}
					{@render item(m.transactions_field_executed_at(), executedAt)}
				{/if}
				{#if tx.rejectedAt}
					{#snippet rejectedAt()}{formatDateTime(tx.rejectedAt ?? '')}{/snippet}
					{@render item(m.transactions_field_rejected_at(), rejectedAt)}
				{/if}
				{#if tx.txHash}
					{#snippet txHash()}{@render explorerLink(`tx/${tx.txHash}`, tx.txHash ?? '')}{/snippet}
					{@render item(m.transactions_field_tx_hash(), txHash)}
				{/if}
			</dl>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.transactions_section_signatures()}</Card.Title>
			<Card.Description>
				{data.required === null
					? m.transactions_section_signatures_description_unknown()
					: m.transactions_section_signatures_description({ required: data.required })}
			</Card.Description>
			<Card.Action>
				<span class="text-lg font-semibold tabular-nums">
					{approvalsLabel(data.signatures.length, data.required)}
				</span>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<DataTable
				columns={signatureColumns}
				data={data.signatures}
				emptyMessage={m.transactions_signatures_empty()}
			/>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.transactions_section_safe_transaction()}</Card.Title>
		</Card.Header>
		<Card.Content>
			<dl class="flex flex-col gap-3">
				{#snippet to()}{@render explorerLink(`address/${tx.to}`, tx.to)}{/snippet}
				{@render item(m.transactions_field_to(), to)}
				{#snippet value()}{m.transactions_value_eth({ amount: formatTokenAmount(tx.value, 18) })}{/snippet}
				{@render item(m.transactions_field_value(), value)}
				{#snippet operation()}
					{tx.operation === 1
						? m.transactions_operation_delegate_call()
						: m.transactions_operation_call()}
				{/snippet}
				{@render item(m.transactions_field_operation(), operation)}
				{#snippet nonce()}{tx.nonce}{/snippet}
				{@render item(m.transactions_field_nonce(), nonce)}
				{#snippet safeTxHash()}{@render mono(tx.safeTxHash)}{/snippet}
				{@render item(m.transactions_field_safe_tx_hash(), safeTxHash)}
				{#snippet callData()}
					{#if tx.data === '0x'}
						{m.transactions_data_empty()}
					{:else}
						<!-- データは長いため、既定では畳んでおく -->
						<Collapsible.Root bind:open={dataOpen} class="flex flex-col gap-2">
							<Collapsible.Trigger>
								{#snippet child({ props })}
									<Button {...props} variant="outline" size="sm" class="w-fit">
										{dataOpen ? m.transactions_data_hide() : m.transactions_data_show()}
									</Button>
								{/snippet}
							</Collapsible.Trigger>
							<Collapsible.Content>
								<pre
									class="bg-muted max-h-64 overflow-auto rounded-md p-3 font-mono text-xs break-all whitespace-pre-wrap">{tx.data}</pre>
							</Collapsible.Content>
						</Collapsible.Root>
					{/if}
				{/snippet}
				{@render item(m.transactions_field_data(), callData)}
			</dl>
		</Card.Content>
	</Card.Root>
</main>
