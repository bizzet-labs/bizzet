<script lang="ts">
import { Button } from '@/components/ui/button/index.js'

let { data } = $props()
</script>

<main class="mx-auto flex max-w-2xl flex-col gap-6 p-6 md:p-10">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Bizzet ダッシュボード</h1>
		<form method="POST" action="/logout">
			<Button variant="outline" type="submit">ログアウト</Button>
		</form>
	</div>
	{#if data.member}
		<p class="text-muted-foreground text-sm">
			{data.member.email}（{data.groupName} / {data.member.role}）としてログイン中
		</p>
		{#if data.member.role === 'owner'}
			<Button href="/members/new" class="self-start">メンバーを招待する</Button>
		{/if}
	{/if}
</main>
