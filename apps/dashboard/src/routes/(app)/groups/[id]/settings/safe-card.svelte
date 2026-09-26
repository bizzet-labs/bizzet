<script lang="ts">
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { enhance } from '$app/forms'
import { formatDateTime } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'
import SafeStatusBadge from '../../safe-status-badge.svelte'
import type { PageData } from './$types'

// 設定を確定したグループの Safe の内容と、未配置なら配置のボタン
let {
  safe,
  canManage,
}: {
  safe: NonNullable<PageData['safe']>
  canManage: boolean
} = $props()

// 配置は取引の完了まで待つため、送信中はボタンを止める
let deploying = $state(false)
</script>

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
					href={safe.url}
					target="_blank"
					rel="noopener noreferrer"
					title={m.groups_safe_etherscan()}
					class="inline-flex items-center gap-1 font-mono text-xs break-all underline-offset-4 hover:underline"
				>
					{safe.address}
					<ExternalLinkIcon class="size-3 shrink-0" />
				</a>
			</dd>
			<dt class="text-muted-foreground">{m.groups_safe_owners()}</dt>
			<dd>
				<ol class="flex flex-col gap-2">
					{#each safe.owners as owner (owner.address)}
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
					threshold: safe.threshold,
					count: safe.owners.length,
				})}
			</dd>
			<dt class="text-muted-foreground">{m.groups_safe_deployment()}</dt>
			<dd class="flex flex-wrap items-center gap-2">
				<SafeStatusBadge status={safe.deployed ? 'deployed' : 'undeployed'} />
				{#if safe.deployedAt}
					<span class="text-muted-foreground text-xs">
						{m.groups_safe_deployed_at({ date: formatDateTime(safe.deployedAt) })}
					</span>
				{/if}
			</dd>
		</dl>
		{#if canManage && !safe.deployed}
			<div class="mt-4 flex flex-col gap-2 border-t pt-4">
				{#if safe.canDeploy}
					<p class="text-muted-foreground text-sm">{m.groups_safe_deploy_note()}</p>
					<form
						method="POST"
						action="?/deploySafe"
						class="flex justify-end"
						use:enhance={() => {
							deploying = true
							return async ({ update }) => {
								await update()
								deploying = false
							}
						}}
					>
						<Button type="submit" disabled={deploying}>
							{deploying ? m.groups_safe_deploying() : m.groups_safe_deploy()}
						</Button>
					</form>
				{:else}
					<p class="text-muted-foreground text-sm">{m.groups_safe_deploy_operator_unset()}</p>
				{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
