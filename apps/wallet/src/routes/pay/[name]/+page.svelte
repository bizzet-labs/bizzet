<script lang="ts">
import {
  encodePermit2Approve,
  encodeSwapExactOutputToRecipient,
  erc20Abi,
  type ReceivingCurrency,
  type ResolvedGroupName,
  resolveGroupName,
  tokens,
  uniswapV4,
} from '@bizzet/contracts'
import CircleIcon from '@lucide/svelte/icons/circle'
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle'
import StoreIcon from '@lucide/svelte/icons/store'
import WalletIcon from '@lucide/svelte/icons/wallet'
import { onMount } from 'svelte'
import {
  type Address,
  erc20Abi as erc20AllowanceAbi,
  getAddress,
  type Hash,
  isAddress,
  maxUint256,
} from 'viem'
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
import {
  jpycPerUsdc,
  otherCurrency,
  permit2Expiration,
  planSwap,
  quoteSwap,
  type SwapQuote,
  type SwapStep,
  swapDeadline,
} from '@/swap.js'
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
  await loadQuote()
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
let balances = $state<Record<ReceivingCurrency, bigint | null>>({
  JPYC: null,
  USDC: null,
})
let hasGas = $state(true)
let txHash = $state<Hash | null>(null)
let payError = $state('')

// 客が払う通貨。受取通貨なら直接送り、もう一方なら Uniswap v4 で交換して店に届ける
let payWith = $state<ReceivingCurrency | null>(null)
const swapCurrency = $derived(currency ? otherCurrency(currency) : null)
const swapToken = $derived(
  swapCurrency ? tokens.find((t) => t.symbol === swapCurrency) : undefined,
)
const swapping = $derived(
  payWith !== null && currency !== null && payWith !== currency,
)

let quote = $state<SwapQuote | null>(null)
let quoteState = $state<'loading' | 'ready' | 'failed'>('loading')

// Uniswap v4 の見積もりから求めた、1 USDC あたりの JPYC の量（JPYC ≒ 円）
const uniswapRate = $derived.by(() => {
  if (!quote || !currency || amount === null) return null
  return currency === 'JPYC'
    ? jpycPerUsdc({ jpycAmount: amount, usdcAmount: quote.amountIn })
    : jpycPerUsdc({ jpycAmount: quote.amountIn, usdcAmount: amount })
})

// 客が払う量。交換するときは見積もりの量で、実際の量は取引の時点で決まる
const payAmount = $derived(swapping ? (quote?.amountIn ?? null) : amount)
const balance = $derived(payWith ? balances[payWith] : null)
const insufficient = $derived(
  balance !== null && payAmount !== null && balance < payAmount,
)

// 交換して支払うときの、ウォレットで承認する取引の並びと進み具合
let swapSteps = $state<SwapStep[]>([])
let swapStepIndex = $state(0)
let swapStepWaiting = $state<'wallet' | 'block'>('wallet')

const SWAP_STEP_LABELS: Record<SwapStep, string> = {
  erc20Approve: 'Permit2 に通貨の利用を許可',
  permit2Approve: 'Uniswap のルーターに Permit2 で許可',
  swap: 'Uniswap v4 で交換して支払う',
}

async function loadQuote() {
  if (!swapToken || !token || amount === null || !recipient) {
    quoteState = 'failed'
    return
  }
  quoteState = 'loading'
  try {
    quote = await quoteSwap(publicClient, {
      tokenIn: swapToken.address,
      tokenOut: token.address,
      amountOut: amount,
    })
    quoteState = 'ready'
  } catch (e) {
    console.error(e)
    quote = null
    quoteState = 'failed'
    if (swapping) payWith = currency
  }
}

async function refreshBalance(account: Address) {
  const balanceOf = (symbol: ReceivingCurrency) => {
    const t = tokens.find((x) => x.symbol === symbol)
    if (!t) return Promise.resolve(null)
    return publicClient.readContract({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    })
  }
  const [jpyc, usdc, ethBalance] = await Promise.all([
    balanceOf('JPYC'),
    balanceOf('USDC'),
    publicClient.getBalance({ address: account }),
  ])
  balances = { JPYC: jpyc, USDC: usdc }
  hasGas = ethBalance > 0n
}

function selectPayWith(value: ReceivingCurrency) {
  if (phase === 'confirming') return
  payWith = value
  payError = ''
}

$effect(() => {
  if (payWith === null && currency) payWith = currency
})

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

// 受取通貨をそのまま店に送る
function sendDirect(w: InjectedWallet, to: Address, value: bigint) {
  if (!token) throw new Error('受取通貨がありません')
  return w.client.writeContract({
    account: w.account,
    chain: w.client.chain,
    address: token.address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, value],
  })
}

// 許可の取引を送り、ブロックに入るまで待つ。失敗したら次の手順に進まない
async function sendAndWait(send: () => Promise<Hash>) {
  swapStepWaiting = 'wallet'
  const hash = await send()
  swapStepWaiting = 'block'
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('許可の取引が失敗しました')
}

// もう一方の通貨を Uniswap v4 で交換し、受取通貨を店に直接届ける。
// 見積もりは支払いの直前に取り直し、許可が足りなければ先に承認してもらう
async function sendSwap(w: InjectedWallet, to: Address, amountOut: bigint) {
  if (!token || !swapToken) throw new Error('交換する通貨がありません')
  const fresh = await quoteSwap(publicClient, {
    tokenIn: swapToken.address,
    tokenOut: token.address,
    amountOut,
  })
  quote = fresh
  swapStepIndex = 0
  swapSteps = await planSwap(publicClient, {
    owner: w.account,
    quote: fresh,
    deadline: swapDeadline(Date.now()),
  })
  for (const [i, step] of swapSteps.entries()) {
    swapStepIndex = i
    if (step === 'erc20Approve') {
      await sendAndWait(() =>
        w.client.writeContract({
          account: w.account,
          chain: w.client.chain,
          address: fresh.tokenIn,
          abi: erc20AllowanceAbi,
          functionName: 'approve',
          args: [uniswapV4.permit2, maxUint256],
        }),
      )
    } else if (step === 'permit2Approve') {
      const tx = encodePermit2Approve({
        token: fresh.tokenIn,
        amount: fresh.amountInMaximum,
        expiration: permit2Expiration(Date.now()),
      })
      await sendAndWait(() =>
        w.client.sendTransaction({
          account: w.account,
          chain: w.client.chain,
          ...tx,
        }),
      )
    }
  }
  swapStepWaiting = 'wallet'
  const tx = encodeSwapExactOutputToRecipient({
    tokenIn: fresh.tokenIn,
    tokenOut: fresh.tokenOut,
    amountOut: fresh.amountOut,
    amountInMaximum: fresh.amountInMaximum,
    recipient: to,
    deadline: swapDeadline(Date.now()),
  })
  return w.client.sendTransaction({
    account: w.account,
    chain: w.client.chain,
    ...tx,
  })
}

async function handlePay() {
  if (!wallet || !token || !recipient || amount === null) return
  phase = 'confirming'
  payError = ''
  swapSteps = []
  try {
    const hash = swapping
      ? await sendSwap(wallet, recipient, amount)
      : await sendDirect(wallet, recipient, amount)
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
      : swapping
        ? 'Uniswap v4 での交換の支払いを送れませんでした'
        : '支払いを送れませんでした'
    phase = txHash ? 'failed' : 'ready'
    // 許可の取引が通った後でも、残高と見積もりを読み直してやり直せるようにする
    if (wallet) await refreshBalance(wallet.account).catch(() => {})
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
							円からはデモ用の固定レート（1 USD = {DEMO_JPY_PER_USD} 円）で換算
						</p>
					{/if}
					{#if uniswapRate !== null}
						<p class="text-muted-foreground text-xs">
							Uniswap v4 の見積もりのレート 1 USDC ≈ {uniswapRate.toLocaleString('ja-JP', {
								maximumFractionDigits: 2,
							})} JPYC
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
					{:else}
						<div class="flex flex-col gap-2" role="radiogroup" aria-label="支払う通貨">
							<span class="text-muted-foreground text-xs">支払う通貨</span>
							<button
								type="button"
								role="radio"
								aria-checked={!swapping}
								disabled={phase === 'confirming'}
								onclick={() => selectPayWith(currency)}
								class={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left text-sm ${!swapping ? 'border-primary ring-primary ring-1' : ''}`}
							>
								<span class="font-medium">{currency} でそのまま支払う</span>
								{#if amount !== null}
									<span class="text-muted-foreground text-xs">
										{formatTokenAmount(amount, currency)}
									</span>
								{/if}
							</button>
							{#if swapCurrency}
								<button
									type="button"
									role="radio"
									aria-checked={swapping}
									disabled={phase === 'confirming' || quoteState !== 'ready'}
									onclick={() => selectPayWith(swapCurrency)}
									class={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left text-sm disabled:opacity-60 ${swapping ? 'border-primary ring-primary ring-1' : ''}`}
								>
									<span class="font-medium">
										{swapCurrency} を Uniswap v4 で交換して支払う
									</span>
									{#if quoteState === 'loading'}
										<span class="text-muted-foreground flex items-center gap-1 text-xs">
											<LoaderCircleIcon class="size-3 animate-spin" />
											Uniswap v4 で見積もっています
										</span>
									{:else if quoteState === 'failed'}
										<span class="text-muted-foreground text-xs">
											Uniswap のプールに流動性がありません
										</span>
									{:else if quote}
										<span class="text-muted-foreground text-xs">
											{swapCurrency} ≈ {formatTokenAmount(quote.amountIn, swapCurrency)}（Uniswap v4 の見積もり）
										</span>
										<span class="text-muted-foreground text-xs">
											最大 {formatTokenAmount(quote.amountInMaximum, swapCurrency)}（見積もり +1%）・店には
											{formatTokenAmount(quote.amountOut, currency)} が届きます
										</span>
									{/if}
								</button>
							{/if}
						</div>

						{#if wallet && token}
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground flex items-center gap-1.5">
									<WalletIcon class="size-4" />
									{shortAddress(wallet.account)}
								</span>
								{#if balance !== null && payWith}
									<span class={insufficient ? 'text-destructive' : ''}>
										残高 {formatTokenAmount(balance, payWith)}
									</span>
								{/if}
							</div>
							{#if insufficient}
								<p class="text-destructive text-center text-sm">{payWith} の残高が足りません</p>
							{:else if !hasGas}
								<p class="text-destructive text-center text-sm">
									ガス代の Sepolia ETH がありません
								</p>
							{/if}
							{#if swapping && swapSteps.length > 0}
								<ol class="flex flex-col gap-1.5 text-sm">
									{#each swapSteps as step, i (step)}
										<li class="flex items-center gap-2">
											{#if i < swapStepIndex}
												<CircleCheckIcon class="size-4 text-emerald-600" />
											{:else if i === swapStepIndex && phase === 'confirming'}
												<LoaderCircleIcon class="size-4 animate-spin" />
											{:else}
												<CircleIcon class="text-muted-foreground size-4" />
											{/if}
											<span class={i > swapStepIndex ? 'text-muted-foreground' : ''}>
												{i + 1}. {SWAP_STEP_LABELS[step]}
											</span>
											{#if i === swapStepIndex && phase === 'confirming'}
												<span class="text-muted-foreground ml-auto text-xs">
													{swapStepWaiting === 'wallet' ? 'ウォレットで承認' : 'ブロック待ち'}
												</span>
											{/if}
										</li>
									{/each}
								</ol>
							{/if}
							<Button
								size="lg"
								onclick={handlePay}
								disabled={phase === 'confirming' ||
									insufficient ||
									!hasGas ||
									payAmount === null}
							>
								{#if phase === 'confirming'}
									<LoaderCircleIcon class="animate-spin" data-icon="inline-start" />
									{swapping && swapSteps.length === 0
										? '見積もりと許可を確認しています'
										: 'ウォレットで承認してください'}
								{:else if swapping && quote && swapCurrency}
									約 {formatTokenAmount(quote.amountIn, swapCurrency)} を交換して支払う
								{:else if amount !== null}
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
