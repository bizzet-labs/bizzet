<script lang="ts">
import InfoIcon from '@lucide/svelte/icons/info'
import * as Alert from '@/components/ui/alert/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'

let { data, form } = $props()

let submitting = $state(false)
// ラベルは英小文字・数字・ハイフンの3〜32文字（サーバーでも同じ規則で確かめる）
const LABEL_PATTERN = '[a-z0-9\\-]{3,32}'
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

<main class="flex max-w-xl flex-col gap-6 p-6 pt-0">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-bold">{data.pageTitle}</h1>
		<p class="text-muted-foreground text-sm">{m.groups_new_description()}</p>
	</div>

	{#if !data.headquartersConfigured}
		<Alert.Root>
			<InfoIcon />
			<Alert.Title>{m.groups_new_hq_unconfigured_title()}</Alert.Title>
			<Alert.Description>{m.groups_new_hq_unconfigured_description()}</Alert.Description>
		</Alert.Root>
	{/if}

	<Card.Root>
		<Card.Content>
			<form
				method="POST"
				use:enhance={() => {
					submitting = true
					return async ({ update }) => {
						await update({ reset: false })
						submitting = false
					}
				}}
			>
				<FieldGroup>
					<Field data-invalid={form?.message && !form?.labelError ? true : undefined}>
						<FieldLabel for="name">{m.groups_new_name_label()}</FieldLabel>
						<Input
							id="name"
							name="name"
							required
							maxlength={100}
							value={form?.name ?? ''}
							aria-invalid={form?.message && !form?.labelError ? true : undefined}
						/>
						{#if form?.message && !form?.labelError}
							<FieldError>{form.message}</FieldError>
						{/if}
					</Field>
					<Field data-invalid={form?.labelError ? true : undefined}>
						<FieldLabel for="label">{m.groups_ens_label_label()}</FieldLabel>
						<Input
							id="label"
							name="label"
							maxlength={32}
							pattern={LABEL_PATTERN}
							placeholder="shibuya"
							value={form?.label ?? ''}
							aria-invalid={form?.labelError ? true : undefined}
						/>
						<FieldDescription>
							{m.groups_ens_label_description({ hq: data.hqEnsName ?? 'bizzet.eth' })}
						</FieldDescription>
						{#if form?.labelError}
							<FieldError>{form.message}</FieldError>
						{/if}
					</Field>
					<div class="flex justify-end gap-2">
						<Button href="/groups" variant="outline">{m.common_cancel()}</Button>
						<Button type="submit" disabled={submitting}>{m.groups_new_submit()}</Button>
					</div>
				</FieldGroup>
			</form>
		</Card.Content>
	</Card.Root>
</main>
