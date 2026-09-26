<script lang="ts">
import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { goto } from '$app/navigation'

// TODO: WebAuthn ログインの実装は未実装。画面のみ先行して作成している。
async function handleLogin() {
  // TODO: navigator.credentials.get() でパスキー認証を行う
  await goto('/')
}
</script>

<svelte:head>
	<title>ログイン | bizzet</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-6">
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="items-center text-center">
			<div class="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-full">
				<FingerprintIcon class="size-6" />
			</div>
			<Card.Title>bizzet</Card.Title>
			<Card.Description>登録したパスキーでログインします</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			<Button size="lg" onclick={handleLogin}>
				<FingerprintIcon data-icon="inline-start" />
				パスキーでログイン
			</Button>
		</Card.Content>
	</Card.Root>
</main>
