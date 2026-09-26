<script lang="ts">
import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
import WalletIcon from '@lucide/svelte/icons/wallet'
import * as Alert from '@/components/ui/alert/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import * as Empty from '@/components/ui/empty/index.js'
import * as Field from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import * as Select from '@/components/ui/select/index.js'
import { Textarea } from '@/components/ui/textarea/index.js'
import { enhance } from '$app/forms'
import { formatTokenAmount } from '$lib/format'
import { m } from '$lib/paraglide/messages.js'

let { data, form } = $props()

// 選択肢の初期値。JavaScript なしで送って入力の誤りで戻ってきたときは、入れた値を残す。
// 以降は選択の操作で変わるため、props の初期値だけを使う
const initialGroupId = () => form?.values?.groupId ?? data.groups[0]?.id ?? ''
const initialToken = () => form?.values?.token ?? data.tokens[0]?.symbol ?? ''
let groupId = $state(initialGroupId())
let token = $state(initialToken())
let submitting = $state(false)

const groupName = $derived(data.groups.find((g) => g.id === groupId)?.name)
const selectedToken = $derived(data.tokens.find((t) => t.symbol === token))
const balance = $derived(
  data.balances.find((b) => b.groupId === groupId && b.symbol === token),
)
const errorFor = (field: string) =>
  form?.field === field ? form.message : undefined
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

<main class="flex max-w-xl flex-col gap-6 p-6 pt-0">
	<div class="flex flex-col gap-3">
		<a
			href="/transactions"
			class="text-muted-foreground inline-flex w-fit items-center gap-1 text-sm hover:underline"
		>
			<ArrowLeftIcon class="size-4" />
			{m.transactions_back_to_list()}
		</a>
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold">{m.transactions_new_title()}</h1>
			<p class="text-muted-foreground text-sm">{m.transactions_new_description()}</p>
		</div>
	</div>

	{#if data.groups.length === 0}
		<Empty.Root class="border">
			<Empty.Header>
				<Empty.Media variant="icon">
					<WalletIcon />
				</Empty.Media>
				<Empty.Title>{m.transactions_no_safe_groups_title()}</Empty.Title>
				<Empty.Description>{m.transactions_no_safe_groups_description()}</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{:else}
		<Card.Root>
			<Card.Content>
				<form
					method="POST"
					use:enhance={() => {
						submitting = true
						return async ({ update }) => {
							submitting = false
							// 入力の誤りのときに入力内容を消さない
							await update({ reset: false })
						}
					}}
					class="flex flex-col gap-6"
				>
					<Field.Group>
						<Field.Field data-invalid={errorFor('groupId') ? true : undefined}>
							<Field.Label for="groupId">{m.transactions_field_paying_group()}</Field.Label>
							<Select.Root type="single" name="groupId" bind:value={groupId}>
								<Select.Trigger id="groupId" class="w-full">
									{groupName ?? m.transactions_select_group()}
								</Select.Trigger>
								<Select.Content>
									{#each data.groups as group (group.id)}
										<Select.Item value={group.id} label={group.name} />
									{/each}
								</Select.Content>
							</Select.Root>
							{#if errorFor('groupId')}
								<Field.Error>{errorFor('groupId')}</Field.Error>
							{/if}
						</Field.Field>

						<Field.Field data-invalid={errorFor('token') ? true : undefined}>
							<Field.Label for="token">{m.transactions_field_token()}</Field.Label>
							<Select.Root type="single" name="token" bind:value={token}>
								<Select.Trigger id="token" class="w-full">
									{selectedToken?.symbol ?? m.transactions_select_token()}
								</Select.Trigger>
								<Select.Content>
									{#each data.tokens as t (t.symbol)}
										<Select.Item value={t.symbol} label={t.symbol} />
									{/each}
								</Select.Content>
							</Select.Root>
							{#if errorFor('token')}
								<Field.Error>{errorFor('token')}</Field.Error>
							{/if}
						</Field.Field>

						<Field.Field data-invalid={errorFor('amount') ? true : undefined}>
							<Field.Label for="amount">{m.transactions_field_amount()}</Field.Label>
							<Input
								id="amount"
								name="amount"
								inputmode="decimal"
								autocomplete="off"
								required
								placeholder={m.transactions_amount_placeholder()}
								value={form?.values?.amount ?? ''}
								aria-invalid={errorFor('amount') ? true : undefined}
							/>
							{#if balance?.balance != null && selectedToken}
								<Field.Description>
									{m.transactions_balance({
										amount: formatTokenAmount(balance.balance, selectedToken.decimals),
										symbol: selectedToken.symbol,
									})}
								</Field.Description>
							{/if}
							{#if errorFor('amount')}
								<Field.Error>{errorFor('amount')}</Field.Error>
							{/if}
						</Field.Field>

						{#if balance && balance.balance === null}
							<Alert.Root>
								<TriangleAlertIcon />
								<Alert.Description>{m.transactions_balance_unavailable()}</Alert.Description>
							</Alert.Root>
						{/if}

						<Field.Field data-invalid={errorFor('recipient') ? true : undefined}>
							<Field.Label for="recipient">{m.transactions_field_recipient()}</Field.Label>
							<Input
								id="recipient"
								name="recipient"
								autocomplete="off"
								spellcheck={false}
								required
								class="font-mono"
								placeholder={m.transactions_recipient_placeholder()}
								value={form?.values?.recipient ?? ''}
								aria-invalid={errorFor('recipient') ? true : undefined}
							/>
							{#if errorFor('recipient')}
								<Field.Error>{errorFor('recipient')}</Field.Error>
							{/if}
						</Field.Field>

						<Field.Field data-invalid={errorFor('memo') ? true : undefined}>
							<Field.Label for="memo">{m.transactions_field_memo()}</Field.Label>
							<Textarea
								id="memo"
								name="memo"
								maxlength={data.memoMaxLength}
								value={form?.values?.memo ?? ''}
								aria-invalid={errorFor('memo') ? true : undefined}
							/>
							{#if errorFor('memo')}
								<Field.Error>{errorFor('memo')}</Field.Error>
							{/if}
						</Field.Field>

						{#if form?.message && !form.field}
							<Alert.Root variant="destructive">
								<TriangleAlertIcon />
								<Alert.Description>{form.message}</Alert.Description>
							</Alert.Root>
						{/if}

						<Field.Field orientation="horizontal">
							<Button type="submit" disabled={submitting}>{m.transactions_submit()}</Button>
							<Button href="/transactions" variant="outline">{m.common_cancel()}</Button>
						</Field.Field>
					</Field.Group>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</main>
