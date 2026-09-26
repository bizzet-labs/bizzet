<script lang="ts">
import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { loadPasskey, login } from '@/passkey.js'
import { goto } from '$app/navigation'
import logoMark from '$lib/assets/logo-mark.png'

let pending = $state(false)
let error = $state('')

// 登録済みのパスキーでログインする。パスキーの登録は招待か追加用のリンクから行う
async function handleLogin() {
  pending = true
  error = ''
  try {
    await login(loadPasskey())
    await goto('/')
  } catch (e) {
    console.error(e)
    // サーバーが断った理由はそのまま出し、パスキーの操作の失敗やキャンセルは一律の文言にする
    error =
      e instanceof Error && e.name === 'Error'
        ? e.message
        : 'パスキーでログインできませんでした'
  } finally {
    pending = false
  }
}
</script>

<svelte:head>
	<title>ログイン | bizzet</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-6">
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="items-center text-center">
			<img src={logoMark} alt="" class="mb-2 h-12 w-auto dark:invert" />
			<Card.Title>bizzet</Card.Title>
			<Card.Description>登録したパスキーでログインします</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			<Button size="lg" onclick={handleLogin} disabled={pending}>
				<FingerprintIcon data-icon="inline-start" />
				パスキーでログイン
			</Button>
			{#if error}
				<p class="text-destructive text-center text-sm">{error}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</main>
