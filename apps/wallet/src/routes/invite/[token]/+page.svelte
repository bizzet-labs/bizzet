<script lang="ts">
import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
import MonitorIcon from '@lucide/svelte/icons/monitor'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { registerPasskey, startSession } from '@/passkey.js'
import { enhance } from '$app/forms'

let { data, form } = $props()

let pending = $state(false)
let error = $state('')
let formEl = $state<HTMLFormElement>()

const roleLabel = { owner: 'Owner', approver: 'Approver', viewer: 'Viewer' }

// 端末でパスキーを作り、その情報をサーバーに送ってメンバーとして登録する
async function handleRegister() {
  pending = true
  error = ''
  try {
    const passkey = await registerPasskey()
    if (!formEl) return
    ;(formEl.elements.namedItem('id') as HTMLInputElement).value = passkey.id
    ;(formEl.elements.namedItem('publicKey') as HTMLInputElement).value =
      passkey.publicKey
    ;(formEl.elements.namedItem('signer') as HTMLInputElement).value =
      passkey.signer
    formEl.requestSubmit()
  } catch (e) {
    console.error(e)
    error = 'パスキーを登録できませんでした'
    pending = false
  }
}
</script>

<svelte:head>
	<title>{data.kind === 'member' ? '招待' : 'ログイン手段の追加'} | bizzet</title>
</svelte:head>

<main class="flex min-h-svh items-center justify-center p-6">
	<Card.Root class="w-full max-w-sm">
		{#if data.kind === 'add_password'}
			<!-- パスワードの追加用リンクは、ダッシュボードで開いてパスワードを決める -->
			<Card.Header class="items-center text-center">
				<div class="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-full">
					<MonitorIcon class="size-6" />
				</div>
				<Card.Title>ダッシュボードで開いてください</Card.Title>
				<Card.Description>
					このリンクは、ダッシュボードのパスワードを設定するためのものです。パソコンのブラウザで、ダッシュボードのリンクとして開いてください
				</Card.Description>
			</Card.Header>
		{:else}
			<Card.Header class="items-center text-center">
				<div class="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-full">
					<FingerprintIcon class="size-6" />
				</div>
				{#if data.kind === 'add_passkey'}
					<Card.Title>パスキーの追加</Card.Title>
					<Card.Description>
						この端末でパスキーを登録すると、ウォレットにログインできるようになります
					</Card.Description>
				{:else}
					<Card.Title>bizzet への招待</Card.Title>
					<Card.Description>
						{data.groupName} の {roleLabel[data.role]} として招待されています
					</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<p class="text-muted-foreground text-center text-sm">{data.email}</p>
				<form
					method="POST"
					bind:this={formEl}
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'redirect') startSession()
							else pending = false
							await update()
						}
					}}
				>
					<input type="hidden" name="id" />
					<input type="hidden" name="publicKey" />
					<input type="hidden" name="signer" />
				</form>
				<Button size="lg" onclick={handleRegister} disabled={pending}>
					<FingerprintIcon data-icon="inline-start" />
					{data.kind === 'add_passkey' ? 'パスキーを登録する' : 'パスキーを登録して始める'}
				</Button>
				{#if error || form?.message}
					<p class="text-destructive text-center text-sm">{error || form?.message}</p>
				{/if}
			</Card.Content>
		{/if}
	</Card.Root>
</main>
