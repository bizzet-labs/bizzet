<script lang="ts">
import PrinterIcon from '@lucide/svelte/icons/printer'
import TagIcon from '@lucide/svelte/icons/tag'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { buildPayUrl, MAX_PRICE_JPY } from '@/pay.js'
import { page } from '$app/state'
import logoMark from '$lib/assets/logo-mark.png'

// 値札を作るページ。グループの名前・価格・商品名から決済ページの URL を作り、QR コードにする
let name = $state(page.url.searchParams.get('name') ?? 'shibuya.bizzet.eth')
let priceJpy = $state(Number(page.url.searchParams.get('amount') ?? 500))
let item = $state(page.url.searchParams.get('item') ?? 'Coffee')

const valid = $derived(
  name.trim().length > 0 &&
    Number.isInteger(priceJpy) &&
    priceJpy > 0 &&
    priceJpy <= MAX_PRICE_JPY,
)
const payUrl = $derived(
  valid
    ? buildPayUrl(page.url.origin, name.trim(), priceJpy, item.trim())
    : null,
)

let qrDataUrl = $state('')
$effect(() => {
  const url = payUrl
  if (!url) {
    qrDataUrl = ''
    return
  }
  let cancelled = false
  QRCode.toDataURL(url, { margin: 1, width: 320 }).then((dataUrl) => {
    if (!cancelled) qrDataUrl = dataUrl
  })
  return () => {
    cancelled = true
  }
})

const inputClass =
  'border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3'
</script>

<svelte:head>
	<title>値札を作る | bizzet</title>
</svelte:head>

<div class="bg-muted/30 flex min-h-svh flex-col items-center gap-6 p-6">
	<header class="flex items-center gap-2 print:hidden">
		<img src={logoMark} alt="" class="h-6 w-auto dark:invert" />
		<span class="font-semibold">値札を作る</span>
	</header>

	<Card.Root class="w-full max-w-sm print:hidden">
		<Card.Content class="flex flex-col gap-3">
			<label class="flex flex-col gap-1 text-sm">
				<span class="font-medium">グループの名前（ENS）</span>
				<input class={`${inputClass} font-mono`} bind:value={name} autocomplete="off" />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span class="font-medium">価格（円）</span>
				<input
					class={inputClass}
					type="number"
					min="1"
					max={MAX_PRICE_JPY}
					step="1"
					bind:value={priceJpy}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span class="font-medium">商品名</span>
				<input class={inputClass} bind:value={item} maxlength="64" />
			</label>
		</Card.Content>
	</Card.Root>

	<Card.Root class="w-full max-w-sm">
		<Card.Content class="flex flex-col items-center gap-3 text-center">
			{#if payUrl && qrDataUrl}
				<div class="flex items-center gap-1.5 text-sm font-medium">
					<TagIcon class="size-4" />
					{item || '商品'}
				</div>
				<p class="text-3xl font-bold">¥{priceJpy.toLocaleString('ja-JP')}</p>
				<img src={qrDataUrl} alt="決済ページの QR コード" class="size-56" />
				<p class="font-mono text-xs">{name}</p>
				<a href={payUrl} class="text-primary text-xs break-all hover:underline print:hidden">
					{payUrl}
				</a>
			{:else}
				<p class="text-muted-foreground text-sm">
					名前と、1〜{MAX_PRICE_JPY.toLocaleString('ja-JP')} 円の価格を入れてください
				</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<Button variant="outline" onclick={() => window.print()} disabled={!payUrl} class="print:hidden">
		<PrinterIcon data-icon="inline-start" />
		値札を印刷
	</Button>
</div>
