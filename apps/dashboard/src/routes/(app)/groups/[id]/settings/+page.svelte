<script lang="ts">
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import * as Alert from '@/components/ui/alert/index.js'
import { Button } from '@/components/ui/button/index.js'
import { explorerTxUrl } from '$lib/explorer'
import { m } from '$lib/paraglide/messages.js'
import EnsCard from './ens-card.svelte'
import HeadquartersSetupCard from './headquarters-setup-card.svelte'
import RolesCard from './roles-card.svelte'
import SafeCard from './safe-card.svelte'
import StoreSetupCard from './store-setup-card.svelte'

let { data, form } = $props()
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
	{:else if form?.action === 'deploySafe' && form.txHash}
		<Alert.Root>
			<CircleCheckIcon />
			<Alert.Title>{m.groups_safe_deployed_done()}</Alert.Title>
			<Alert.Description>
				<a
					href={explorerTxUrl(form.txHash)}
					target="_blank"
					rel="noopener noreferrer"
					class="underline underline-offset-4"
				>
					{m.groups_safe_deploy_tx()}
				</a>
			</Alert.Description>
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

	<EnsCard kind={data.group.kind} canManage={data.canManage} ens={data.ens} />

	{#if data.safe}
		<SafeCard safe={data.safe} canManage={data.canManage} />
	{:else if data.group.kind === 'headquarters'}
		<HeadquartersSetupCard
			candidates={data.candidates}
			canManage={data.canManage}
			minOwners={data.minOwners}
			threshold={data.headquartersThreshold}
		/>
	{:else}
		<StoreSetupCard headquartersConfigured={data.headquartersConfigured} canManage={data.canManage} />
	{/if}

	{#if data.roles}
		<RolesCard roles={data.roles} canManage={data.canManage} />
	{/if}
</main>
