<script lang="ts">
import { onMount } from 'svelte'
import { callApi } from '@/api.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { formatUnitsJa, shortAddress } from '@/format.js'
import { loadPasskey, type StoredPasskey } from '@/passkey.js'

type RefundItem = {
  id: string
  refund: boolean
  description: string
  token: { symbol: string; decimals: number } | null
  amount: string | null
  recipient: string | null
  status: 'open' | 'submitted' | 'executed' | 'rejected'
  signatureCount: number
  createdAt: string
}

type RefundPage = {
  group: { name: string; kind: 'headquarters' | 'store'; hasSafe: boolean }
  canRequest: boolean
  tokens: { symbol: string; decimals: number }[]
  memoMaxLength: number
  requiredApprovals: number | null
  refunds: RefundItem[]
}

let passkey: StoredPasskey | null = null
let page = $state<RefundPage | null>(null)
let loadError = $state('')

let token = $state('JPYC')
let amount = $state('')
let recipient = $state('')
let memo = $state('')
let submitting = $state(false)
let submitError = $state('')
let submitted = $state(false)

async function load() {
  if (!passkey) return
  page = await callApi<RefundPage>('/api/refunds', passkey)
}

onMount(async () => {
  passkey = loadPasskey()
  if (!passkey) {
    loadError =
      'この端末にパスキーがありません。招待か追加用のリンクから登録してください'
    return
  }
  try {
    await load()
  } catch (e) {
    console.error(e)
    loadError = e instanceof Error ? e.message : '読み込めませんでした'
  }
})

async function handleSubmit(event: SubmitEvent) {
  event.preventDefault()
  if (!passkey) return
  submitting = true
  submitError = ''
  submitted = false
  try {
    await callApi<{ id: string }>('/api/refunds/create', passkey, {
      token,
      amount,
      recipient,
      memo,
    })
    amount = ''
    recipient = ''
    memo = ''
    submitted = true
    await load()
  } catch (e) {
    console.error(e)
    submitError = e instanceof Error ? e.message : '申請できませんでした'
  } finally {
    submitting = false
  }
}

// 送信前の提案は、署名が0件なら申請中、1件以上なら承認待ち
function statusLabel(item: RefundItem) {
  switch (item.status) {
    case 'open':
      return item.signatureCount === 0 ? '申請中' : '承認待ち'
    case 'submitted':
      return '送信済み'
    case 'executed':
      return '実行済み'
    case 'rejected':
      return '却下'
  }
}

function statusClass(status: RefundItem['status']) {
  if (status === 'executed') return 'text-primary'
  if (status === 'rejected') return 'text-destructive'
  return 'text-muted-foreground'
}

function formatAmount(item: RefundItem) {
  if (!item.token || item.amount === null) return '—'
  const value = formatUnitsJa(
    item.amount,
    item.token.decimals,
    item.token.decimals,
  )
  return `${value} ${item.token.symbol}`
}

function recipientLabel(address: string | null) {
  return address ? shortAddress(address) : '—'
}

const inputClass =
  'border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]'
</script>

<svelte:head>
	<title>返金 | bizzet</title>
</svelte:head>

<div class="bg-muted/30 min-h-svh">
	<header class="bg-background border-b px-6 py-4">
		<div class="mx-auto max-w-2xl">
			<span class="font-semibold">返金</span>
		</div>
	</header>

	<main class="mx-auto flex max-w-2xl flex-col gap-4 p-6">
		{#if loadError}
			<p class="text-destructive text-sm">{loadError}</p>
		{:else if !page}
			<p class="text-muted-foreground text-sm">読み込み中…</p>
		{:else if page.group.kind === 'headquarters'}
			<Card.Root>
				<Card.Header>
					<Card.Title>返金は店舗のメンバーが申請します</Card.Title>
					<Card.Description>
						店舗のメンバーが申請した返金は、本部の Owner と Approver が承認の画面で署名して実行します
					</Card.Description>
				</Card.Header>
			</Card.Root>
		{:else}
			<Card.Root>
				<Card.Header>
					<Card.Title>返金を申請する</Card.Title>
					<Card.Description>
						{page.group.name} の Safe から客へ返金します。実行は本部の Owner と Approver の承認で行います
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if !page.canRequest}
						<p class="text-muted-foreground text-sm">この店舗の Safe はまだ設定されていません</p>
					{:else}
						<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
							<label class="flex flex-col gap-1.5 text-sm">
								<span class="font-medium">通貨</span>
								<select class={inputClass} bind:value={token}>
									{#each page.tokens as t (t.symbol)}
										<option value={t.symbol}>{t.symbol}</option>
									{/each}
								</select>
							</label>
							<label class="flex flex-col gap-1.5 text-sm">
								<span class="font-medium">金額</span>
								<input
									class={inputClass}
									inputmode="decimal"
									placeholder="1000"
									required
									bind:value={amount}
								/>
							</label>
							<label class="flex flex-col gap-1.5 text-sm">
								<span class="font-medium">客のアドレス</span>
								<input
									class="{inputClass} font-mono"
									placeholder="0x…"
									autocomplete="off"
									spellcheck="false"
									required
									bind:value={recipient}
								/>
							</label>
							<label class="flex flex-col gap-1.5 text-sm">
								<span class="font-medium">メモ（任意）</span>
								<input
									class={inputClass}
									maxlength={page.memoMaxLength}
									placeholder="注文番号など"
									bind:value={memo}
								/>
							</label>
							{#if submitError}
								<p class="text-destructive text-sm">{submitError}</p>
							{/if}
							{#if submitted}
								<p class="text-primary text-sm">返金を申請しました</p>
							{/if}
							<Button type="submit" class="self-start" disabled={submitting}>
								{submitting ? '申請中…' : '申請する'}
							</Button>
						</form>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="py-2">
				<Card.Header class="px-6 pt-4">
					<Card.Title>申請の状況</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-col px-0">
					{#if page.refunds.length === 0}
						<p class="text-muted-foreground px-6 py-3 text-sm">まだ申請はありません</p>
					{/if}
					{#each page.refunds as item, i (item.id)}
						<div class="flex items-start gap-3 px-6 py-3 {i > 0 ? 'border-t' : ''}">
							<div class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="font-medium tabular-nums">{formatAmount(item)}</span>
								<span class="text-muted-foreground font-mono text-xs">
									宛先 {recipientLabel(item.recipient)}
								</span>
								<span class="text-muted-foreground text-xs">
									{item.refund ? item.description : `出金${item.description ? `：${item.description}` : ''}`}
									・{new Date(item.createdAt).toLocaleString('ja-JP')}
								</span>
							</div>
							<div class="flex flex-col items-end gap-0.5 text-xs">
								<span class="font-medium {statusClass(item.status)}">{statusLabel(item)}</span>
								{#if item.status === 'open'}
									<span class="text-muted-foreground tabular-nums">
										署名 {item.signatureCount}{page.requiredApprovals !== null
											? ` / ${page.requiredApprovals}`
											: ''}
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		{/if}
	</main>
</div>
