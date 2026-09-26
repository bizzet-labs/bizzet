<script lang="ts">
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import * as Alert from '@/components/ui/alert/index.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'
import AssignmentFields from '../assignment-fields.svelte'
import type { Role } from '../columns.js'
import CopyLink from '../copy-link.svelte'

let { data, form } = $props()

// 本部を先頭に並べているため、既定では本部の Viewer を選ぶ
const initialGroupId = () => data.groups[0]?.id ?? ''
let groupId = $state(initialGroupId())
let role = $state<Role>('viewer')
let pending = $state(false)

const values = $derived(form?.values)
// 作った招待のリンク。失敗したときの form には含まれない
const created = $derived(
  form?.dashboardUrl && form.walletUrl
    ? {
        email: form.email ?? '',
        dashboardUrl: form.dashboardUrl,
        walletUrl: form.walletUrl,
      }
    : null,
)
</script>

<svelte:head>
	<title>{m.common_title({ page: data.pageTitle })}</title>
</svelte:head>

<main class="flex max-w-xl flex-col gap-6 p-6 pt-0">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-bold">{m.members_invite_heading()}</h1>
		<p class="text-muted-foreground text-sm">{m.members_invite_description()}</p>
	</div>

	{#if created}
		<Alert.Root>
			<CircleCheckIcon />
			<Alert.Title>{m.members_invite_created({ email: created.email })}</Alert.Title>
			<Alert.Description>{m.members_invite_created_description()}</Alert.Description>
		</Alert.Root>
		<Card.Root>
			<Card.Content>
				<FieldGroup>
					<CopyLink
						id="dashboard-url"
						label={m.members_invite_link_dashboard()}
						description={m.members_invite_link_dashboard_description()}
						url={created.dashboardUrl}
					/>
					<CopyLink
						id="wallet-url"
						label={m.members_invite_link_wallet()}
						description={m.members_invite_link_wallet_description()}
						url={created.walletUrl}
					/>
				</FieldGroup>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Content>
			<form
				method="POST"
				use:enhance={() => {
					pending = true
					return async ({ update }) => {
						pending = false
						await update()
					}
				}}
			>
				<FieldGroup>
					<Field>
						<FieldLabel for="email">{m.members_field_email()}</FieldLabel>
						<Input id="email" name="email" type="email" value={values?.email ?? ''} required />
					</Field>
					<Field>
						<FieldLabel for="name">{m.members_field_name_optional()}</FieldLabel>
						<Input id="name" name="name" value={values?.name ?? ''} />
					</Field>
					<Field>
						<FieldLabel for="title">{m.members_field_title_optional()}</FieldLabel>
						<Input
							id="title"
							name="title"
							value={values?.title ?? ''}
							placeholder={m.members_field_title_placeholder()}
						/>
					</Field>
					<AssignmentFields groups={data.groups} bind:groupId bind:role idPrefix="invite" />
					{#if form?.message}
						<p class="text-destructive text-sm">{form.message}</p>
					{/if}
					<Field>
						<Button type="submit" disabled={pending}>{m.members_invite_submit()}</Button>
					</Field>
				</FieldGroup>
			</form>
		</Card.Content>
	</Card.Root>

	<a href="/members" class="text-sm underline underline-offset-4">{m.members_back_to_list()}</a>
</main>
