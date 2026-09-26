<script lang="ts">
import { Button } from '@/components/ui/button/index.js'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { enhance } from '$app/forms'

let { data, form } = $props()

let pending = $state(false)

const roleLabel = { owner: 'Owner', approver: 'Approver', viewer: 'Viewer' }
</script>

<svelte:head>
	<title>招待 | bizzet</title>
</svelte:head>

<main class="mx-auto flex max-w-md flex-col gap-6 p-6 md:p-10">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-bold">ダッシュボードに参加する</h1>
		<p class="text-muted-foreground text-sm">
			{data.groupName} の {roleLabel[data.role]} として招待されています。ログインに使うパスワードを決めてください
		</p>
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
				<FieldLabel for="email">メールアドレス</FieldLabel>
				<Input id="email" type="email" value={data.email} readonly />
			</Field>
			<Field>
				<FieldLabel for="password">パスワード（8文字以上）</FieldLabel>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					minlength={8}
					required
				/>
			</Field>
			<Field>
				<FieldLabel for="confirm">パスワード（確認）</FieldLabel>
				<Input
					id="confirm"
					name="confirm"
					type="password"
					autocomplete="new-password"
					minlength={8}
					required
				/>
			</Field>
			{#if form?.message}
				<p class="text-destructive text-sm">{form.message}</p>
			{/if}
			<Field>
				<Button type="submit" disabled={pending}>登録してログイン</Button>
			</Field>
		</FieldGroup>
	</form>
</main>
