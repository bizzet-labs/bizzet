<script lang="ts">
import CopyIcon from '@lucide/svelte/icons/copy'
import KeyRoundIcon from '@lucide/svelte/icons/key-round'
import LogOutIcon from '@lucide/svelte/icons/log-out'
import UserIcon from '@lucide/svelte/icons/user'
import WalletIcon from '@lucide/svelte/icons/wallet'
import { onMount } from 'svelte'
import { callApi } from '@/approvals.js'
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

type PasswordLink = { url: string; expiresAt: string }
type Me = {
  member: {
    name: string | null
    title: string | null
    email: string
    role: 'owner' | 'approver' | 'viewer'
  }
  group: { name: string; kind: 'headquarters' | 'store' }
  hasPassword: boolean
  passwordLink: PasswordLink | null
}

const roleLabels: Record<Me['member']['role'], string> = {
  owner: 'Owner',
  approver: 'Approver',
  viewer: 'Viewer',
}

let me = $state<Me | null>(null)
let meError = $state('')
let issuing = $state(false)
let issueError = $state('')
let copied = $state(false)

async function loadMe(key: StoredPasskey) {
  try {
    me = await callApi<Me>('/api/me', key)
  } catch (e) {
    console.error(e)
    meError = e instanceof Error ? e.message : '読み込めませんでした'
  }
}

// ダッシュボードのパスワードを追加するためのリンク（1時間有効）を発行する
async function handleIssue() {
  if (!passkey || !me) return
  issuing = true
  issueError = ''
  copied = false
  try {
    const { passwordLink } = await callApi<{ passwordLink: PasswordLink }>(
      '/api/me/password-link',
      passkey,
    )
    me.passwordLink = passwordLink
  } catch (e) {
    console.error(e)
    issueError = e instanceof Error ? e.message : 'リンクを発行できませんでした'
  } finally {
    issuing = false
  }
}

async function handleCopy() {
  if (!me?.passwordLink) return
  try {
    await navigator.clipboard.writeText(me.passwordLink.url)
    copied = true
  } catch (e) {
    console.error(e)
  }
}

onMount(async () => {
  passkey = loadPasskey()
  if (!passkey) {
    status = 'この端末にパスキーがありません'
    return
  }
  void loadMe(passkey)
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

	<main class="mx-auto flex max-w-2xl flex-col gap-4 p-6">
		{#if meError}
			<p class="text-destructive text-sm">{meError}</p>
		{:else if me}
			<Card.Root class="py-2">
				<Card.Content class="flex flex-col px-0">
					<div class="flex items-start gap-3 border-b px-6 py-3">
						<UserIcon class="text-muted-foreground mt-0.5 size-5" />
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="font-medium">{me.member.name || me.member.email}</span>
							{#if me.member.name}
								<span class="text-muted-foreground text-xs break-all">{me.member.email}</span>
							{/if}
							<span class="text-muted-foreground text-xs">
								{me.group.name}（{me.group.kind === 'headquarters' ? '本部' : '店舗'}）・{roleLabels[
									me.member.role
								]}{me.member.title ? `・${me.member.title}` : ''}
							</span>
						</div>
					</div>
					<div class="flex items-start gap-3 px-6 py-3">
						<KeyRoundIcon class="text-muted-foreground mt-0.5 size-5" />
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<span class="font-medium">ダッシュボードのパスワード</span>
							{#if me.hasPassword}
								<span class="text-muted-foreground text-xs">登録済み</span>
							{:else}
								<span class="text-muted-foreground text-xs">
									未登録です。追加用リンクをパソコンで開き、パスワードを決めるとダッシュボードにログインできます
								</span>
								{#if me.passwordLink}
									<div class="bg-muted mt-1 flex items-center gap-2 rounded-md px-3 py-2">
										<span class="min-w-0 flex-1 font-mono text-xs break-all">{me.passwordLink.url}</span>
										<Button size="sm" variant="outline" onclick={handleCopy}>
											<CopyIcon class="size-4" />
											{copied ? 'コピーしました' : 'コピー'}
										</Button>
									</div>
									<span class="text-muted-foreground text-xs">
										{new Date(me.passwordLink.expiresAt).toLocaleString('ja-JP')} まで有効
									</span>
								{/if}
								<Button
									size="sm"
									variant={me.passwordLink ? 'outline' : 'default'}
									class="mt-1 self-start"
									onclick={handleIssue}
									disabled={issuing}
								>
									{issuing ? '発行中…' : me.passwordLink ? 'リンクを発行し直す' : '追加用リンクを発行'}
								</Button>
								{#if issueError}
									<span class="text-destructive text-xs">{issueError}</span>
								{/if}
							{/if}
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

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
