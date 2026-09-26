<script lang="ts">
import type { ReceivingCurrency, ResolvedGroupName } from '@bizzet/contracts'
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { shortAddress } from '@/format.js'
import {
  DEMO_JPY_PER_USD,
  formatTokenAmount,
  parsePriceTag,
  toTokenAmount,
} from '@/pay.js'
import { otherCurrency, type SwapStep } from '@/swap.js'
import { page } from '$app/state'
import logoMark from '$lib/assets/logo-mark.png'
import PriceHeader from './price-header.svelte'
import StoreSummary from './store-summary.svelte'
import SwapSteps from './swap-steps.svelte'

// デモモードの支払い。ENS の代わりにサーバーが DB から解決した受取先を使い、ウォレットも取引も使わない
let {
  resolution,
}: {
  resolution: {
    name: string
    address: string
    currency: ReceivingCurrency
    description: string
  } | null
} = $props()

// 交換の各手順と、支払いの処理中に見せる待ち時間（ミリ秒）
const SWAP_STEP_MS = 800
const PAY_MS = 1500
const DEMO_SWAP_STEPS: SwapStep[] = ['erc20Approve', 'permit2Approve', 'swap']

const name = $derived(page.params.name ?? '')
const priceTag = $derived(parsePriceTag(page.url.searchParams))
const resolved = $derived<ResolvedGroupName | null>(
  resolution
    ? {
        name: resolution.name,
        address: resolution.address as Address,
        currency: resolution.currency,
        description: resolution.description,
      }
    : null,
)
const currency = $derived(resolution?.currency ?? null)
const amount = $derived(
  priceTag && currency ? toTokenAmount(priceTag.priceJpy, currency) : null,
)
const swapCurrency = $derived(currency ? otherCurrency(currency) : null)
// 固定レートでの交換の見積もり（払う側の通貨の量）
const swapAmountIn = $derived(
  priceTag && swapCurrency
    ? toTokenAmount(priceTag.priceJpy, swapCurrency)
    : null,
)

let payWith = $state<'direct' | 'swap'>('direct')
let phase = $state<'idle' | 'confirming' | 'pending' | 'done' | 'failed'>(
  'idle',
)
let stepIndex = $state(0)
let txHash = $state('')
let payError = $state('')

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function handlePay() {
  if (!priceTag || !resolution) return
  payError = ''
  try {
    if (payWith === 'swap') {
      phase = 'confirming'
      for (const [i] of DEMO_SWAP_STEPS.entries()) {
        stepIndex = i
        await wait(SWAP_STEP_MS)
      }
    }
    phase = 'pending'
    const [response] = await Promise.all([
      fetch('/api/demo/pay', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, priceJpy: priceTag.priceJpy }),
      }),
      wait(PAY_MS),
    ])
    if (!response.ok) throw new Error('支払いを記録できませんでした')
    ;({ txHash } = (await response.json()) as { txHash: string })
    phase = 'done'
  } catch (e) {
    console.error(e)
    payError = e instanceof Error ? e.message : '支払いを送れませんでした'
    phase = 'failed'
  }
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
			</Card.Content>
		{:else}
			<PriceHeader
				{priceTag}
				{amount}
				{currency}
				uniswapRate={payWith === 'swap' ? DEMO_JPY_PER_USD : null}
			/>
			<Card.Content class="flex flex-col gap-4">
				<StoreSummary
					resolving={false}
					{name}
					{resolved}
					recipient={resolution?.address ?? null}
					{currency}
					mocked={false}
				/>
				{#if !resolution || !currency}
					<div class="flex flex-col items-center gap-1 text-center">
						<CircleAlertIcon class="text-destructive size-6" />
						<p class="text-sm font-medium">この名前の受取先がありません</p>
					</div>
				{:else if phase === 'done'}
					<div class="flex flex-col items-center gap-2 py-2 text-center">
						<CircleCheckIcon class="size-12 text-emerald-600" />
						<p class="text-2xl font-bold">済</p>
						<p class="text-muted-foreground text-sm">お支払いが完了しました</p>
						<p class="text-muted-foreground font-mono text-xs">取引 {shortAddress(txHash)}（模擬）</p>
					</div>
				{:else if phase === 'pending'}
					<div class="flex flex-col items-center gap-2 py-2 text-center">
						<LoaderCircleIcon class="text-muted-foreground size-12 animate-spin" />
						<p class="text-2xl font-bold">処理中</p>
					</div>
				{:else}
					<div class="flex flex-col gap-2" role="radiogroup" aria-label="支払う通貨">
						<span class="text-muted-foreground text-xs">支払う通貨</span>
						<button
							type="button"
							role="radio"
							aria-checked={payWith === 'direct'}
							disabled={phase === 'confirming'}
							onclick={() => (payWith = 'direct')}
							class={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left text-sm ${payWith === 'direct' ? 'border-primary ring-primary ring-1' : ''}`}
						>
							<span class="font-medium">{currency} でそのまま支払う</span>
							{#if amount !== null}
								<span class="text-muted-foreground text-xs">{formatTokenAmount(amount, currency)}</span>
							{/if}
						</button>
						{#if swapCurrency}
							<button
								type="button"
								role="radio"
								aria-checked={payWith === 'swap'}
								disabled={phase === 'confirming'}
								onclick={() => (payWith = 'swap')}
								class={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left text-sm ${payWith === 'swap' ? 'border-primary ring-primary ring-1' : ''}`}
							>
								<span class="font-medium">{swapCurrency} を Uniswap v4 で交換して支払う</span>
								{#if swapAmountIn !== null}
									<span class="text-muted-foreground text-xs">
										{swapCurrency} ≈ {formatTokenAmount(swapAmountIn, swapCurrency)}（1 USDC = {DEMO_JPY_PER_USD} JPYC の模擬の見積もり）
									</span>
								{/if}
							</button>
						{/if}
					</div>
					{#if payWith === 'swap' && phase === 'confirming'}
						<SwapSteps steps={DEMO_SWAP_STEPS} {stepIndex} confirming={true} waiting="block" />
					{/if}
					<Button size="lg" onclick={handlePay} disabled={phase === 'confirming'}>
						{#if phase === 'confirming'}
							<LoaderCircleIcon class="animate-spin" data-icon="inline-start" />
						{/if}
						支払う（デモ）
					</Button>
				{/if}
				{#if payError}
					<p class="text-destructive text-center text-sm">{payError}</p>
				{/if}
			</Card.Content>
		{/if}
	</Card.Root>
</div>
