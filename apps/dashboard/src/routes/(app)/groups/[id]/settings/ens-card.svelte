<script lang="ts">
import InfoIcon from '@lucide/svelte/icons/info'
import * as Alert from '@/components/ui/alert/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import * as Select from '@/components/ui/select/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'
import EnsResolved from '../../ens-resolved.svelte'
import EnsStatusBadge from '../../ens-status-badge.svelte'

type Currency = 'JPYC' | 'USDC'

let {
  kind,
  canManage,
  ens,
}: {
  kind: 'headquarters' | 'store'
  canManage: boolean
  ens: {
    configured: boolean
    hqName: string | null
    label: string | null
    currency: Currency
    status: 'unregistered' | 'registered' | 'failed'
    txUrl: string | null
    view: {
      name: string
      resolved: { address: string | null; currency: Currency | null } | null
      mismatch: boolean
    } | null
  }
} = $props()

const CURRENCIES: Currency[] = ['JPYC', 'USDC']
// ラベルは英小文字・数字・ハイフンの3〜32文字（サーバーでも同じ規則で確かめる）
const LABEL_PATTERN = '[a-z0-9\\-]{3,32}'

// フォームの初期値は保存済みの値にし、その後は入力を保つ
// svelte-ignore state_referenced_locally
let currency = $state<Currency>(ens.currency)
let submitting = $state(false)
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.groups_ens_card_title()}</Card.Title>
		<Card.Description>{m.groups_ens_card_description()}</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
			<dt class="text-muted-foreground">{m.groups_ens_name()}</dt>
			<dd class="font-mono text-xs break-all">{ens.view?.name ?? '—'}</dd>
			<dt class="text-muted-foreground">{m.groups_ens_status()}</dt>
			<dd class="flex flex-wrap items-center gap-2">
				<EnsStatusBadge status={ens.status} />
				{#if ens.txUrl}
					<a
						href={ens.txUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xs underline underline-offset-4"
					>
						{m.groups_safe_etherscan()}
					</a>
				{/if}
			</dd>
		</dl>
		{#if ens.view}
			<EnsResolved view={ens.view} />
		{/if}

		{#if !ens.configured}
			<Alert.Root>
				<InfoIcon />
				<Alert.Title>{m.groups_ens_not_configured_title()}</Alert.Title>
				<Alert.Description>{m.groups_ens_not_configured_description()}</Alert.Description>
			</Alert.Root>
		{:else if canManage}
			<form
				method="POST"
				action="?/saveEns"
				use:enhance={() => {
					submitting = true
					return async ({ update }) => {
						await update({ reset: false })
						submitting = false
					}
				}}
			>
				<FieldGroup>
					{#if kind === 'store'}
						<Field>
							<FieldLabel for="ens-label">{m.groups_ens_label_label()}</FieldLabel>
							<Input
								id="ens-label"
								name="label"
								maxlength={32}
								pattern={LABEL_PATTERN}
								placeholder="shibuya"
								value={ens.label ?? ''}
							/>
							<FieldDescription>
								{m.groups_ens_label_description({ hq: ens.hqName ?? 'bizzet.eth' })}
							</FieldDescription>
						</Field>
					{/if}
					<Field>
						<FieldLabel for="ens-currency">{m.groups_ens_currency()}</FieldLabel>
						<input type="hidden" name="currency" value={currency} />
						<Select.Root
							type="single"
							value={currency}
							onValueChange={(value) => {
								currency = value as Currency
							}}
						>
							<Select.Trigger id="ens-currency" class="w-full">{currency}</Select.Trigger>
							<Select.Content>
								{#each CURRENCIES as option (option)}
									<Select.Item value={option} label={option} />
								{/each}
							</Select.Content>
						</Select.Root>
					</Field>
					<div class="flex justify-end">
						<Button type="submit" disabled={submitting}>
							{ens.status === 'failed' ? m.groups_ens_retry() : m.groups_ens_save()}
						</Button>
					</div>
				</FieldGroup>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
