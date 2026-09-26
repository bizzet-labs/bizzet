<script lang="ts">
import { Button } from '@/components/ui/button/index.js'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { enhance } from '$app/forms'

let { data, form } = $props()
</script>

<svelte:head>
	<title>メンバーの招待 | bizzet</title>
</svelte:head>

<main class="flex max-w-md flex-col gap-6 p-6 pt-0">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-bold">メンバーを招待する</h1>
		<p class="text-muted-foreground text-sm">
			招待リンクを送ると、メンバーはパスワードを決めてダッシュボードに参加できます（7日間有効）
		</p>
	</div>

	{#if form?.inviteUrl}
		<div class="rounded-md border p-4 text-sm">
			<p class="mb-2">{form.email} への招待リンク：</p>
			<code class="break-all">{form.inviteUrl}</code>
		</div>
	{/if}

	<form method="POST" use:enhance class="flex flex-col gap-6">
		<FieldGroup>
			<Field>
				<FieldLabel for="email">メールアドレス</FieldLabel>
				<Input id="email" name="email" type="email" required />
			</Field>
			<Field>
				<FieldLabel for="groupId">グループ</FieldLabel>
				<select
					id="groupId"
					name="groupId"
					required
					class="border-input bg-background h-9 rounded-md border px-3 text-sm"
				>
					{#each data.groups as group (group.id)}
						<option value={group.id}>{group.name}</option>
					{/each}
				</select>
			</Field>
			<Field>
				<FieldLabel for="role">ロール</FieldLabel>
				<select
					id="role"
					name="role"
					required
					class="border-input bg-background h-9 rounded-md border px-3 text-sm"
				>
					<option value="viewer">Viewer</option>
					<option value="approver">Approver</option>
					<option value="owner">Owner</option>
				</select>
			</Field>
			{#if form?.message}
				<p class="text-destructive text-sm">{form.message}</p>
			{/if}
			<Field>
				<Button type="submit">招待リンクを作る</Button>
			</Field>
		</FieldGroup>
	</form>
	<a href="/members" class="text-sm underline underline-offset-4">メンバーの一覧に戻る</a>
</main>
