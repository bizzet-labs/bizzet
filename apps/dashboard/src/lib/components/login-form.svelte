<script lang="ts">
import { Button } from '@/components/ui/button/index.js'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { cn } from '@/utils.js'
import { enhance } from '$app/forms'

let {
  email = '',
  message,
  class: className,
}: { email?: string; message?: string; class?: string } = $props()

let pending = $state(false)
</script>

<div class={cn("flex flex-col gap-6", className)}>
	<FieldGroup>
		<div class="flex flex-col items-center gap-1 text-center">
			<h1 class="text-2xl font-bold">ダッシュボードにログイン</h1>
			<p class="text-sm text-balance text-muted-foreground">
				メールアドレスとパスワードでログインします
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
			<Field>
				<FieldLabel for="email">メールアドレス</FieldLabel>
				<Input
					id="email"
					name="email"
					type="email"
					autocomplete="username"
					value={email}
					required
				/>
			</Field>
			<Field>
				<FieldLabel for="password">パスワード</FieldLabel>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</Field>
			{#if message}
				<p class="text-destructive text-center text-sm">{message}</p>
			{/if}
			<Field>
				<Button type="submit" size="lg" disabled={pending}>ログイン</Button>
			</Field>
		</form>
		<p class="text-center text-sm text-muted-foreground">
			アカウントは、管理者からの招待リンクから作成します
		</p>
	</FieldGroup>
</div>
