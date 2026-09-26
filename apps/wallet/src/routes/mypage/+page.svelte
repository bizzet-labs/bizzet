<script lang="ts">
import LogOutIcon from '@lucide/svelte/icons/log-out'
import WalletIcon from '@lucide/svelte/icons/wallet'
import { onMount } from 'svelte'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { endSession, loadPasskey, type StoredPasskey } from '@/passkey.js'
import { getSafeAddress, isSafeDeployed } from '@/safe.js'
import { sendPasskeyTransaction } from '@/user-operation.js'
import { goto } from '$app/navigation'

let safeAddress = $state('')
let deployed = $state<boolean | null>(null)
let status = $state('読み込み中…')
let passkey: StoredPasskey | null = null
let creating = $state(false)
let createError = $state('')
let transactionHash = $state('')

onMount(async () => {
  passkey = loadPasskey()
  if (!passkey) {
    status = 'この端末にパスキーがありません'
    return
  }
  try {
    const address = await getSafeAddress(passkey)
    safeAddress = address
    deployed = await isSafeDeployed(address)
  } catch (e) {
    console.error(e)
    status = 'アドレスを取得できませんでした'
  }
})

// 仮置き：最初の取引として、Safe から自分自身へ 0 ETH を送る。Safe と署名者は、この取引の中で作られる
async function handleCreate() {
  if (!passkey || !safeAddress) return
  creating = true
  createError = ''
  try {
    transactionHash = await sendPasskeyTransaction(passkey, [
      { to: safeAddress as `0x${string}`, value: 0n, data: '0x' },
    ])
    deployed = true
  } catch (e) {
    console.error(e)
    createError = 'ウォレットを作成できませんでした'
  } finally {
    creating = false
  }
}

async function handleLogout() {
  endSession()
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
				<div class="flex items-start gap-3 border-b px-6 py-3">
					<WalletIcon class="text-muted-foreground mt-0.5 size-5" />
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<span class="font-medium">ウォレットのアドレス</span>
						{#if safeAddress}
							<a
								href={`https://sepolia.etherscan.io/address/${safeAddress}`}
								target="_blank"
								rel="noreferrer"
								class="text-muted-foreground font-mono text-xs break-all hover:underline"
							>
								{safeAddress}
							</a>
							{#if deployed === false}
								<span class="text-muted-foreground text-xs">未作成（最初の取引で作成されます）</span>
								<Button size="sm" class="mt-2 self-start" onclick={handleCreate} disabled={creating}>
									{creating ? '作成中…' : 'ウォレットを作成'}
								</Button>
								{#if createError}
									<span class="text-destructive text-xs">{createError}</span>
								{/if}
							{/if}
							{#if transactionHash}
								<a
									href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
									target="_blank"
									rel="noreferrer"
									class="text-primary text-xs hover:underline"
								>
									作成した取引を見る
								</a>
							{/if}
						{:else}
							<span class="text-muted-foreground text-xs">{status}</span>
						{/if}
					</div>
				</div>
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
