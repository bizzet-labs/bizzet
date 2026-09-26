<script lang="ts">
import LogOutIcon from '@lucide/svelte/icons/log-out'
import * as Card from '@/components/ui/card/index.js'
import { goto } from '$app/navigation'

// TODO: WebAuthn のログアウト（セッション破棄）は未実装。画面のみ先行して作成している。
async function handleLogout() {
  await goto('/login')
}
</script>

<svelte:head>
	<title>マイページ | bizzet</title>
</svelte:head>

<div class="bg-muted/30 min-h-svh">
	<header class="bg-background border-b px-6 py-4">
		<div class="mx-auto max-w-2xl">
			<span class="font-semibold">マイページ</span>
		</div>
	</header>

	<main class="mx-auto max-w-2xl p-6">
		<Card.Root class="py-2">
			<Card.Content class="flex flex-col px-0">
				<button
					type="button"
					onclick={handleLogout}
					class="text-destructive hover:bg-muted/50 flex items-center gap-3 px-6 py-3 text-left"
				>
					<LogOutIcon class="size-5" />
					<span class="flex-1 font-medium">ログアウト</span>
				</button>
			</Card.Content>
		</Card.Root>
	</main>
</div>
