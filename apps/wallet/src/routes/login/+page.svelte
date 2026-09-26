<script lang="ts">
import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { roleLabels } from '@/format.js'
import {
  loadPasskey,
  login,
  type StoredPasskey,
  savePasskey,
} from '@/passkey.js'
import { goto } from '$app/navigation'
import logoMark from '$lib/assets/logo-mark.png'

let { data } = $props()

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

// デモモードのログイン。パスキーの署名なしで、選んだメンバーのセッションを作る
async function handleDemoLogin(memberId: string) {
  pending = true
  error = ''
  try {
    const response = await fetch('/api/session/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    if (!response.ok) throw new Error('ログインできませんでした')
    savePasskey((await response.json()) as StoredPasskey)
    await goto('/')
  } catch (e) {
    console.error(e)
    error = e instanceof Error ? e.message : 'ログインできませんでした'
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
			{#if data.demoMembers}
				{#each data.demoMembers as m (m.id)}
					<div class="flex items-center justify-between gap-3 rounded-lg border p-3">
						<div class="flex min-w-0 flex-col">
							<span class="font-medium">{m.name}</span>
							<span class="text-muted-foreground text-xs">{m.groupName}・{roleLabels[m.role]}</span>
						</div>
						<Button size="sm" onclick={() => handleDemoLogin(m.id)} disabled={pending}>
							このメンバーでログイン
						</Button>
					</div>
				{:else}
					<p class="text-muted-foreground text-center text-sm">パスキーを登録したメンバーがいません</p>
				{/each}
			{:else}
				<Button size="lg" onclick={handleLogin} disabled={pending}>
					<FingerprintIcon data-icon="inline-start" />
					パスキーでログイン
				</Button>
			{/if}
			{#if error}
				<p class="text-destructive text-center text-sm">{error}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</main>
