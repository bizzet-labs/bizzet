<script lang="ts">
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
import InfoIcon from '@lucide/svelte/icons/info'
import * as Alert from '@/components/ui/alert/index.js'
import { Badge } from '@/components/ui/badge/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'
import type { PageData } from './$types'

// 店舗の Safe の Roles v2 の状況と、設定の提案の作成
let {
  roles,
  canManage,
}: {
  roles: NonNullable<PageData['roles']>
  canManage: boolean
} = $props()

// 提案の状態。送信前は、署名が0件なら申請中、1件以上なら承認待ち
function proposalStatusLabel(status: string, signatureCount: number) {
  if (status === 'executed') return m.groups_roles_status_executed()
  if (status === 'submitted') return m.groups_roles_status_submitted()
  return signatureCount > 0
    ? m.groups_roles_status_awaiting()
    : m.groups_roles_status_requested()
}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.groups_roles_title()}</Card.Title>
		<Card.Description>{m.groups_roles_description()}</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
			<dt class="text-muted-foreground">{m.groups_roles_state()}</dt>
			<dd>
				{#if roles.enabled}
					<Badge variant="secondary">{m.groups_roles_enabled()}</Badge>
				{:else}
					<Badge variant="outline">{m.groups_roles_disabled()}</Badge>
				{/if}
			</dd>
			<dt class="text-muted-foreground">{m.groups_roles_proposal()}</dt>
			<dd class="flex flex-wrap items-center gap-2">
				{#if roles.proposal}
					<Badge variant="outline">
						{proposalStatusLabel(roles.proposal.status, roles.proposal.signatureCount)}
					</Badge>
					<span class="text-muted-foreground text-xs">
						{m.groups_roles_proposal_value({
							nonce: roles.proposal.nonce,
							count: roles.proposal.signatureCount,
						})}
					</span>
					<a href="/transactions/{roles.proposal.id}" class="text-xs underline underline-offset-4">
						{m.groups_roles_proposal_open()}
					</a>
				{:else}
					<span class="text-muted-foreground">{m.groups_roles_proposal_none()}</span>
				{/if}
			</dd>
			<dt class="text-muted-foreground">{m.groups_roles_address()}</dt>
			<dd class="min-w-0">
				<a
					href={roles.rolesUrl}
					target="_blank"
					rel="noopener noreferrer"
					title={m.groups_safe_etherscan()}
					class="inline-flex items-center gap-1 font-mono text-xs break-all underline-offset-4 hover:underline"
				>
					{roles.rolesAddress}
					<ExternalLinkIcon class="size-3 shrink-0" />
				</a>
			</dd>
			<dt class="text-muted-foreground">{m.groups_roles_keeper()}</dt>
			<dd class="font-mono text-xs break-all">{roles.keeper ?? '—'}</dd>
			<dt class="text-muted-foreground">{m.groups_roles_recipient()}</dt>
			<dd class="font-mono text-xs break-all">{roles.recipient ?? '—'}</dd>
			<dt class="text-muted-foreground">{m.groups_roles_tokens()}</dt>
			<dd>{roles.tokens.join(', ')}</dd>
		</dl>

		<!-- 提案がなく、まだ有効でないときだけ、提案の作成とその前提の案内を出す -->
		{#if !roles.proposal && !roles.enabled}
			{#if !roles.keeper}
				<Alert.Root>
					<InfoIcon />
					<Alert.Title>{m.groups_roles_keeper_unset_title()}</Alert.Title>
					<Alert.Description>{m.groups_roles_keeper_unset_description()}</Alert.Description>
				</Alert.Root>
			{:else if canManage && roles.recipient}
				<form method="POST" action="?/proposeRoles" use:enhance class="flex justify-end">
					<Button type="submit">{m.groups_roles_create()}</Button>
				</form>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>
