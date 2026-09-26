<script lang="ts">
import {
  erc20Abi,
  type ReceivingCurrency,
  type ResolvedGroupName,
  resolveGroupName,
  tokens,
} from '@bizzet/contracts'
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle'
import StoreIcon from '@lucide/svelte/icons/store'
import WalletIcon from '@lucide/svelte/icons/wallet'
import { onMount } from 'svelte'
import { type Address, getAddress, type Hash, isAddress } from 'viem'
import { publicClient } from '@/chain.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import {
  connectInjectedWallet,
  getInjectedProvider,
  type InjectedWallet,
  isUserRejection,
} from '@/injected-wallet.js'
import {
  DEMO_JPY_PER_USD,
  formatTokenAmount,
  parsePriceTag,
  shortAddress,
  toTokenAmount,
} from '@/pay.js'
import { dev } from '$app/environment'
import { page } from '$app/state'
import { env } from '$env/dynamic/public'
import logoMark from '$lib/assets/logo-mark.png'

const name = $derived(page.params.name ?? '')
const priceTag = $derived(parsePriceTag(page.url.searchParams))

let resolving = $state(true)
let resolved = $state<ResolvedGroupName | null>(null)
let resolveError = $state('')
let mocked = $state(false)

// 開発用：名前を Sepolia に登録する前の画面確認のため、開発サーバーでだけ
// PUBLIC_PAY_MOCK_RESOLUTION（「アドレス,通貨,店名」）を解決結果の代わりに使う。本番のビルドでは読まない
function mockResolution(): ResolvedGroupName | null {
  const raw = dev ? env.PUBLIC_PAY_MOCK_RESOLUTION : undefined
  if (!raw) return null
  const [address, currency, description] = raw.split(',')
  if (!address || !isAddress(address)) return null
  return {
    name,
    address: getAddress(address),
    currency: currency === 'JPYC' || currency === 'USDC' ? currency : null,
    description: description || null,
  }
}

onMount(async () => {
  try {
    const mock = mockResolution()
    if (mock) {
      mocked = true
      resolved = mock
    } else {
      resolved = await resolveGroupName(publicClient, name)
    }
  } catch (e) {
    console.error(e)
    resolveError = 'この名前は ENS の名前として正しくありません'
  } finally {
    resolving = false
  }
})

const recipient = $derived(resolved?.address ?? null)
const currency = $derived<ReceivingCurrency | null>(resolved?.currency ?? null)
const token = $derived(
  currency ? tokens.find((t) => t.symbol === currency) : undefined,
)
const amount = $derived(
  priceTag && currency ? toTokenAmount(priceTag.priceJpy, currency) : null,
)

type Phase =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'confirming'
  | 'pending'
  | 'done'
  | 'failed'

let phase = $state<Phase>('idle')
let wallet = $state<InjectedWallet | null>(null)
let balance = $state<bigint | null>(null)
let hasGas = $state(true)
let txHash = $state<Hash | null>(null)
let payError = $state('')

const insufficient = $derived(
  balance !== null && amount !== null && balance < amount,
)

async function refreshBalance(account: Address) {
  if (!token) return
  const [tokenBalance, ethBalance] = await Promise.all([
    publicClient.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    }),
    publicClient.getBalance({ address: account }),
  ])
  balance = tokenBalance
  hasGas = ethBalance > 0n
}

async function handleConnect() {
  const provider = getInjectedProvider()
  if (!provider) {
    payError =
      'ブラウザにウォレットが見つかりません。MetaMask などのウォレットのブラウザで開いてください'
    return
  }
  phase = 'connecting'
  payError = ''
  try {
    wallet = await connectInjectedWallet(provider)
    await refreshBalance(wallet.account)
    phase = 'ready'
  } catch (e) {
    console.error(e)
    payError = isUserRejection(e)
      ? 'ウォレットの接続が拒否されました'
      : 'ウォレットを Sepolia につなげませんでした'
    phase = 'idle'
  }
}

async function handlePay() {
  if (!wallet || !token || !recipient || amount === null) return
  phase = 'confirming'
  payError = ''
  try {
    const hash = await wallet.client.writeContract({
      account: wallet.account,
      chain: wallet.client.chain,
      address: token.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amount],
    })
    txHash = hash
    phase = 'pending'
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status === 'success') {
      phase = 'done'
    } else {
      phase = 'failed'
      payError = '取引が失敗しました'
    }
    await refreshBalance(wallet.account).catch(() => {})
  } catch (e) {
    console.error(e)
    payError = isUserRejection(e)
      ? '支払いがキャンセルされました'
      : '支払いを送れませんでした'
    phase = txHash ? 'failed' : 'ready'
  }
}

function formatYen(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}
</script>

<svelte:head>
	<title>お支払い | bizzet</title>
</svelte:head>

<div class="bg-muted/30 flex min-h-svh flex-col items-center p-6">
	<header class="mb-6 flex items-center gap-2 self-center">
		<img src={logoMark} alt="" class="h-6 w-auto dark:invert" />
		<span class="font-semibold">bizzet</span>
	</header>

	<Card.Root class="w-full max-w-sm">
		{#if !priceTag}
			<Card.Content class="flex flex-col items-center gap-2 py-6 text-center">
				<CircleAlertIcon class="text-destructive size-8" />
				<p class="font-medium">値札の価格を読めませんでした</p>
				<p class="text-muted-foreground text-sm">値札の QR コードを読み直してください</p>
			</Card.Content>
		{:else}
			<Card.Header class="items-center text-center">
				<Card.Description>{priceTag.item || 'お支払い'}</Card.Description>
				<Card.Title class="text-4xl font-bold tracking-tight">
					{formatYen(priceTag.priceJpy)}
				</Card.Title>
				{#if amount !== null && currency}
					<p class="text-muted-foreground text-sm">
						{formatTokenAmount(amount, currency)} でのお支払い
					</p>
					{#if currency === 'USDC'}
						<p class="text-muted-foreground text-xs">
							デモ用の固定レート（1 USD = {DEMO_JPY_PER_USD} 円）で換算
						</p>
					{/if}
				{/if}
			</Card.Header>

			<Card.Content class="flex flex-col gap-4">
				<div class="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
					<StoreIcon class="text-muted-foreground mt-0.5 size-5" />
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						{#if resolving}
							<span class="text-muted-foreground flex items-center gap-2 text-sm">
								<LoaderCircleIcon class="size-4 animate-spin" />
								{name} を ENS で解決しています
							</span>
						{:else}
							<span class="font-medium">{resolved?.description ?? name}</span>
							<span class="font-mono text-xs">{name}</span>
							{#if recipient}
								<a
									href={`https://sepolia.etherscan.io/address/${recipient}`}
									target="_blank"
									rel="noreferrer"
									class="text-muted-foreground inline-flex items-center gap-1 font-mono text-xs hover:underline"
								>
									受取先 {shortAddress(recipient)}
									<ExternalLinkIcon class="size-3" />
								</a>
							{/if}
							{#if currency}
								<span class="text-muted-foreground text-xs">受取通貨 {currency}</span>
							{/if}
							{#if mocked}
								<span class="mt-1 self-start rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
									開発用のモック（ENS で解決していません）
								</span>
							{/if}
						{/if}
					</div>
				</div>

				{#if !resolving}
					{#if resolveError || !recipient}
						<div class="flex flex-col items-center gap-1 text-center">
							<CircleAlertIcon class="text-destructive size-6" />
							<p class="text-sm font-medium">
								{resolveError || 'この名前の受取先が ENS に設定されていません'}
							</p>
							<p class="text-muted-foreground text-xs">お店の方に値札を確認してもらってください</p>
						</div>
					{:else if !currency}
						<div class="flex flex-col items-center gap-1 text-center">
							<CircleAlertIcon class="text-destructive size-6" />
							<p class="text-sm font-medium">この名前の受取通貨が ENS に設定されていません</p>
						</div>
					{:else if phase === 'done'}
						<div class="flex flex-col items-center gap-2 py-2 text-center">
							<CircleCheckIcon class="size-12 text-emerald-600" />
							<p class="text-2xl font-bold">済</p>
							<p class="text-muted-foreground text-sm">お支払いが完了しました</p>
						</div>
					{:else if phase === 'pending'}
						<div class="flex flex-col items-center gap-2 py-2 text-center">
							<LoaderCircleIcon class="text-muted-foreground size-12 animate-spin" />
							<p class="text-2xl font-bold">処理中</p>
							<p class="text-muted-foreground text-sm">取引がブロックに入るのを待っています</p>
						</div>
					{:else if wallet && token}
						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground flex items-center gap-1.5">
								<WalletIcon class="size-4" />
								{shortAddress(wallet.account)}
							</span>
							{#if balance !== null && currency}
								<span class={insufficient ? 'text-destructive' : ''}>
									残高 {formatTokenAmount(balance, currency)}
								</span>
							{/if}
						</div>
						{#if insufficient}
							<p class="text-destructive text-center text-sm">{currency} の残高が足りません</p>
						{:else if !hasGas}
							<p class="text-destructive text-center text-sm">
								ガス代の Sepolia ETH がありません
							</p>
						{/if}
						<Button
							size="lg"
							onclick={handlePay}
							disabled={phase === 'confirming' || insufficient || !hasGas}
						>
							{#if phase === 'confirming'}
								<LoaderCircleIcon class="animate-spin" data-icon="inline-start" />
								ウォレットで承認してください
							{:else if amount !== null && currency}
								{formatTokenAmount(amount, currency)} を支払う
							{/if}
						</Button>
					{:else}
						<Button size="lg" onclick={handleConnect} disabled={phase === 'connecting'}>
							{#if phase === 'connecting'}
								<LoaderCircleIcon class="animate-spin" data-icon="inline-start" />
							{:else}
								<WalletIcon data-icon="inline-start" />
							{/if}
							ウォレットをつなぐ
						</Button>
					{/if}

					{#if txHash}
						<a
							href={`https://sepolia.etherscan.io/tx/${txHash}`}
							target="_blank"
							rel="noreferrer"
							class="text-primary inline-flex items-center justify-center gap-1 text-xs hover:underline"
						>
							取引 {shortAddress(txHash)} を見る
							<ExternalLinkIcon class="size-3" />
						</a>
					{/if}
					{#if payError}
						<p class="text-destructive text-center text-sm">{payError}</p>
					{/if}
				{/if}
			</Card.Content>
		{/if}
	</Card.Root>

	<p class="text-muted-foreground mt-4 text-xs">Sepolia テストネットでのお支払いです</p>
</div>
