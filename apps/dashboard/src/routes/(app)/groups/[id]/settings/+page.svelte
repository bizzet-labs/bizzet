<script lang="ts">
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
import InfoIcon from '@lucide/svelte/icons/info'
import DataTable from '@/components/data-table/data-table.svelte'
import * as Alert from '@/components/ui/alert/index.js'
import { Badge } from '@/components/ui/badge/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { enhance } from '$app/forms'
import { formatDateTime } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import { getLocale } from '$lib/paraglide/runtime'
import SafeStatusBadge from '../../safe-status-badge.svelte'
import { candidateColumns } from './columns.js'
import ConfirmSubmit from './confirm-submit.svelte'

let { data, form } = $props()

const HQ_FORM_ID = 'configure-headquarters'
const STORE_FORM_ID = 'configure-store'

const columns = $derived(candidateColumns(HQ_FORM_ID, data.canManage))
const readyCount = $derived(data.candidates.filter((c) => c.hasPasskey).length)
// 名前の区切りは表示言語に合わせる（日本語は「、」、英語は「and」でつなぐ）
const missingPasskeys = $derived(
  new Intl.ListFormat(getLocale()).format(
    data.candidates.filter((c) => !c.hasPasskey).map((c) => c.label),
  ),
)

// 提案の状態。送信前は、署名が0件なら申請中、1件以上なら承認待ち
function proposalStatusLabel(status: string, signatureCount: number) {
  if (status === 'executed') return m.groups_roles_status_executed()
  if (status === 'submitted') return m.groups_roles_status_submitted()
  return signatureCount > 0
    ? m.groups_roles_status_awaiting()
    : m.groups_roles_status_requested()
}
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	<div class="flex items-center justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold">{data.pageTitle}</h1>
			<p class="text-muted-foreground text-sm">{m.groups_settings_description()}</p>
		</div>
		<Button href="/groups/{data.group.id}" variant="outline">{m.groups_open_detail()}</Button>
	</div>

	{#if form?.message}
		<Alert.Root variant="destructive">
			<CircleAlertIcon />
			<Alert.Title>{form.message}</Alert.Title>
		</Alert.Root>
	{:else if form?.action === 'proposeRoles' && form.proposalId}
		<Alert.Root>
			<CircleCheckIcon />
			<Alert.Title>{m.groups_roles_created()}</Alert.Title>
			<Alert.Description>
				<a href="/transactions/{form.proposalId}" class="underline underline-offset-4">
					{m.groups_roles_proposal_open()}
				</a>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if data.safe}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.groups_safe_card_title()}</Card.Title>
				<Card.Description>{m.groups_safe_immutable_note()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
					<dt class="text-muted-foreground">{m.groups_safe_address()}</dt>
					<dd class="min-w-0">
						<a
							href={data.safe.url}
							target="_blank"
							rel="noopener noreferrer"
							title={m.groups_safe_etherscan()}
							class="inline-flex items-center gap-1 font-mono text-xs break-all underline-offset-4 hover:underline"
						>
							{data.safe.address}
							<ExternalLinkIcon class="size-3 shrink-0" />
						</a>
					</dd>
					<dt class="text-muted-foreground">{m.groups_safe_owners()}</dt>
					<dd>
						<ol class="flex flex-col gap-2">
							{#each data.safe.owners as owner (owner.address)}
								<li class="flex flex-col">
									<span>{owner.label}</span>
									<span class="text-muted-foreground font-mono text-xs break-all">{owner.address}</span>
								</li>
							{/each}
						</ol>
					</dd>
					<dt class="text-muted-foreground">{m.groups_safe_threshold()}</dt>
					<dd>
						{m.groups_safe_threshold_value({
							threshold: data.safe.threshold,
							count: data.safe.owners.length,
						})}
					</dd>
					<dt class="text-muted-foreground">{m.groups_safe_deployment()}</dt>
					<dd class="flex flex-wrap items-center gap-2">
						<SafeStatusBadge status={data.safe.deployed ? 'deployed' : 'undeployed'} />
						{#if data.safe.deployedAt}
							<span class="text-muted-foreground text-xs">
								{m.groups_safe_deployed_at({ date: formatDateTime(data.safe.deployedAt) })}
							</span>
						{/if}
					</dd>
				</dl>
			</Card.Content>
		</Card.Root>
	{:else if data.group.kind === 'headquarters'}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.groups_hq_setup_title()}</Card.Title>
				<Card.Description>
					{m.groups_hq_setup_description({
						min: data.minOwners,
						threshold: data.headquartersThreshold,
					})}
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<DataTable
					{columns}
					data={data.candidates}
					emptyMessage={m.groups_candidate_empty()}
				/>
				{#if readyCount < data.minOwners}
					<Alert.Root>
						<InfoIcon />
						<Alert.Title>{m.groups_hq_setup_not_enough_title()}</Alert.Title>
						<Alert.Description>
							{m.groups_hq_setup_not_enough_description({
								count: readyCount,
								min: data.minOwners,
							})}
						</Alert.Description>
					</Alert.Root>
				{/if}
				{#if missingPasskeys}
					<p class="text-muted-foreground text-sm">
						{m.groups_hq_setup_missing_passkeys({ names: missingPasskeys })}
					</p>
				{/if}
				{#if data.canManage}
					<form id={HQ_FORM_ID} method="POST" action="?/configureHeadquarters" use:enhance class="flex justify-end">
						<ConfirmSubmit
							formId={HQ_FORM_ID}
							label={m.groups_hq_setup_submit()}
							title={m.groups_hq_setup_confirm_title()}
							description={m.groups_hq_setup_confirm_description({
								count: readyCount,
								threshold: data.headquartersThreshold,
							})}
							disabled={readyCount < data.minOwners}
						/>
					</form>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.groups_store_setup_title()}</Card.Title>
				<Card.Description>{m.groups_store_setup_description()}</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if !data.headquartersConfigured}
					<Alert.Root>
						<InfoIcon />
						<Alert.Title>{m.groups_error_hq_unconfigured()}</Alert.Title>
						<Alert.Description>{m.groups_store_setup_hq_unconfigured()}</Alert.Description>
					</Alert.Root>
				{:else if data.canManage}
					<form id={STORE_FORM_ID} method="POST" action="?/configureStore" use:enhance class="flex justify-end">
						<ConfirmSubmit
							formId={STORE_FORM_ID}
							label={m.groups_store_setup_submit()}
							title={m.groups_store_setup_confirm_title()}
							description={m.groups_store_setup_confirm_description()}
						/>
					</form>
				{:else}
					<p class="text-muted-foreground text-sm">{m.groups_safe_unconfigured_description()}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if data.roles}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.groups_roles_title()}</Card.Title>
				<Card.Description>{m.groups_roles_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
					<dt class="text-muted-foreground">{m.groups_roles_state()}</dt>
					<dd>
						{#if data.roles.enabled}
							<Badge variant="secondary">{m.groups_roles_enabled()}</Badge>
						{:else}
							<Badge variant="outline">{m.groups_roles_disabled()}</Badge>
						{/if}
					</dd>
					<dt class="text-muted-foreground">{m.groups_roles_proposal()}</dt>
					<dd class="flex flex-wrap items-center gap-2">
						{#if data.roles.proposal}
							<Badge variant="outline">
								{proposalStatusLabel(data.roles.proposal.status, data.roles.proposal.signatureCount)}
							</Badge>
							<span class="text-muted-foreground text-xs">
								{m.groups_roles_proposal_value({
									nonce: data.roles.proposal.nonce,
									count: data.roles.proposal.signatureCount,
								})}
							</span>
							<a href="/transactions/{data.roles.proposal.id}" class="text-xs underline underline-offset-4">
								{m.groups_roles_proposal_open()}
							</a>
						{:else}
							<span class="text-muted-foreground">{m.groups_roles_proposal_none()}</span>
						{/if}
					</dd>
					<dt class="text-muted-foreground">{m.groups_roles_address()}</dt>
					<dd class="min-w-0">
						<a
							href={data.roles.rolesUrl}
							target="_blank"
							rel="noopener noreferrer"
							title={m.groups_safe_etherscan()}
							class="inline-flex items-center gap-1 font-mono text-xs break-all underline-offset-4 hover:underline"
						>
							{data.roles.rolesAddress}
							<ExternalLinkIcon class="size-3 shrink-0" />
						</a>
					</dd>
					<dt class="text-muted-foreground">{m.groups_roles_keeper()}</dt>
					<dd class="font-mono text-xs break-all">{data.roles.keeper ?? '—'}</dd>
					<dt class="text-muted-foreground">{m.groups_roles_recipient()}</dt>
					<dd class="font-mono text-xs break-all">{data.roles.recipient ?? '—'}</dd>
					<dt class="text-muted-foreground">{m.groups_roles_tokens()}</dt>
					<dd>{data.roles.tokens.join(', ')}</dd>
				</dl>

				<!-- 提案がなく、まだ有効でないときだけ、提案の作成とその前提の案内を出す -->
				{#if !data.roles.proposal && !data.roles.enabled}
					{#if !data.roles.keeper}
						<Alert.Root>
							<InfoIcon />
							<Alert.Title>{m.groups_roles_keeper_unset_title()}</Alert.Title>
							<Alert.Description>{m.groups_roles_keeper_unset_description()}</Alert.Description>
						</Alert.Root>
					{:else if data.canManage && data.roles.recipient}
						<form method="POST" action="?/proposeRoles" use:enhance class="flex justify-end">
							<Button type="submit">{m.groups_roles_create()}</Button>
						</form>
					{/if}
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</main>
