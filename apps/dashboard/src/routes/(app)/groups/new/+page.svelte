<script lang="ts">
import InfoIcon from '@lucide/svelte/icons/info'
import * as Alert from '@/components/ui/alert/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'

let { data, form } = $props()

let submitting = $state(false)
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
					<Field data-invalid={form?.message ? true : undefined}>
						<FieldLabel for="name">{m.groups_new_name_label()}</FieldLabel>
						<Input
							id="name"
							name="name"
							required
							maxlength={100}
							value={form?.name ?? ''}
							aria-invalid={form?.message ? true : undefined}
						/>
						{#if form?.message}
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
