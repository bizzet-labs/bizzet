<script lang="ts">
import { Button } from '@/components/ui/button/index.js'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'

let { data, form } = $props()

let pending = $state(false)

const ROLE_LABELS = {
  owner: m.common_role_owner,
  approver: m.common_role_approver,
  viewer: m.common_role_viewer,
} as const
</script>

<svelte:head>
	<title>{m.common_title({ page: m.auth_invite_title() })}</title>
</svelte:head>

<main class="mx-auto flex max-w-md flex-col gap-6 p-6 md:p-10">
	<div class="flex flex-col gap-1">
		{#if data.kind === 'add_password'}
			<h1 class="text-2xl font-bold">{m.auth_add_password_heading()}</h1>
			<p class="text-muted-foreground text-sm">{m.auth_add_password_description()}</p>
		{:else}
			<h1 class="text-2xl font-bold">{m.auth_invite_heading()}</h1>
			<p class="text-muted-foreground text-sm">
				{m.auth_invite_description({
					group: data.groupName,
					role: ROLE_LABELS[data.role](),
				})}
			</p>
		{/if}
	</div>

	<form
		method="POST"
		class="flex flex-col gap-6"
		use:enhance={() => {
			pending = true
			return async ({ result, update }) => {
				if (result.type !== 'redirect') pending = false
				await update()
			}
		}}
	>
		<FieldGroup>
			<Field>
				<FieldLabel for="email">{m.auth_email()}</FieldLabel>
				<Input id="email" type="email" class="h-10" value={data.email} readonly />
			</Field>
			<Field>
				<FieldLabel for="password">
					{m.auth_password_with_min({ min: data.passwordMinLength })}
				</FieldLabel>
				<Input
					id="password"
					name="password"
					type="password"
					class="h-10"
					autocomplete="new-password"
					minlength={data.passwordMinLength}
					required
				/>
			</Field>
			<Field>
				<FieldLabel for="confirm">{m.auth_password_confirm()}</FieldLabel>
				<Input
					id="confirm"
					name="confirm"
					type="password"
					class="h-10"
					autocomplete="new-password"
					minlength={data.passwordMinLength}
					required
				/>
			</Field>
			{#if form?.message}
				<p class="text-destructive text-sm">{form.message}</p>
			{/if}
			<Field>
				<Button type="submit" size="lg" class="h-10" disabled={pending}>
					{m.auth_register_submit()}
				</Button>
			</Field>
		</FieldGroup>
	</form>
</main>
