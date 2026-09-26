<script lang="ts">
import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
import * as Alert from '@/components/ui/alert/index.js'
import { Badge } from '@/components/ui/badge/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { enhance } from '$app/forms'
import { formatDateTime } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import CopyLink from '../members/copy-link.svelte'
import LoginMethods from '../members/login-methods.svelte'
import RoleBadge from '../members/role-badge.svelte'

let { data, form } = $props()

let pending = $state(false)

const KIND_LABELS = {
  headquarters: m.common_group_kind_headquarters,
  store: m.common_group_kind_store,
} as const

// Owner と Approver は Safe のオーナーになるため、パスキーがないと署名できない
const needsPasskey = $derived(
  data.account.role !== 'viewer' && !data.account.hasPasskey,
)
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

<main class="flex max-w-xl flex-col gap-6 p-6 pt-0">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-bold">{m.common_nav_account()}</h1>
		<p class="text-muted-foreground text-sm">{m.members_account_description()}</p>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{data.account.name || data.account.email}</Card.Title>
			{#if data.account.title}
				<Card.Description>{data.account.title}</Card.Description>
			{/if}
		</Card.Header>
		<Card.Content>
			<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
				<dt class="text-muted-foreground">{m.members_field_email()}</dt>
				<dd>{data.account.email}</dd>
				<dt class="text-muted-foreground">{m.members_field_group()}</dt>
				<dd class="flex items-center gap-2">
					{data.account.groupName}
					<Badge variant="outline">{KIND_LABELS[data.account.groupKind]()}</Badge>
				</dd>
				<dt class="text-muted-foreground">{m.members_field_role()}</dt>
				<dd><RoleBadge role={data.account.role} /></dd>
				<dt class="text-muted-foreground">{m.members_column_login_methods()}</dt>
				<dd><LoginMethods member={data.account} /></dd>
			</dl>
		</Card.Content>
	</Card.Root>

	{#if !data.account.hasPasskey}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.members_account_passkey_title()}</Card.Title>
				<Card.Description>{m.members_account_passkey_description()}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#if needsPasskey}
					<Alert.Root variant="destructive">
						<TriangleAlertIcon />
						<Alert.Title>{m.members_account_passkey_required()}</Alert.Title>
					</Alert.Root>
				{/if}
				{#if data.passkeyLink}
					<CopyLink
						id="passkey-link"
						label={m.members_account_passkey_link()}
						description={m.members_account_passkey_link_expires({
							expiresAt: formatDateTime(data.passkeyLink.expiresAt),
						})}
						url={data.passkeyLink.url}
					/>
				{/if}
				{#if form?.message}
					<p class="text-destructive text-sm">{form.message}</p>
				{/if}
				<form
					method="POST"
					action="?/issuePasskeyLink"
					use:enhance={() => {
						pending = true
						return async ({ update }) => {
							pending = false
							await update()
						}
					}}
				>
					<Button type="submit" variant={data.passkeyLink ? 'outline' : 'default'} disabled={pending}>
						<FingerprintIcon data-icon="inline-start" />
						{data.passkeyLink ? m.members_account_passkey_reissue() : m.members_account_passkey_issue()}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</main>
