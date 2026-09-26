<script lang="ts">
import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
import SendIcon from '@lucide/svelte/icons/send'
import { onMount } from 'svelte'
import { formatUnits, type Hex } from 'viem'
import { callApi, executeApproval, signApproval } from '@/approvals.js'
import { Button } from '@/components/ui/button/index.js'
import * as Card from '@/components/ui/card/index.js'
import { loadPasskey, type StoredPasskey } from '@/passkey.js'

type Approval = {
  id: string
  kind: 'payout' | 'owner_change' | 'safe_setup'
  groupName: string
  description: string | null
  token: { symbol: string; decimals: number } | null
  amount: string | null
  recipient: string | null
  to: string
  value: string
  data: string
  nonce: number
  safeTxHash: string
  createdAt: string
  signatureCount: number
  threshold: number | null
  signedByMe: boolean
  unsignable:
    | 'store_safe'
    | 'not_owner'
    | 'already_signed'
    | 'ready'
    | 'no_headquarters'
    | null
  executable: boolean
}

const kindLabel = {
  payout: '出金',
  owner_change: 'オーナーの変更',
  safe_setup: 'Safe の設定',
}

const unsignableLabel = {
  store_safe:
    '店舗の Safe の提案は、本部の Safe のコントラクト署名が要るため、まだウォレットで署名できません',
  not_owner: 'あなたのパスキーは本部の Safe のオーナーではありません',
  already_signed: '署名済みです',
  ready: '必要な署名がそろっています',
  no_headquarters: '本部の Safe が設定されていません',
}

let passkey: StoredPasskey | null = null
let approvals = $state<Approval[] | null>(null)
let canSign = $state(true)
let error = $state('')
let busyId = $state('')
let actionError = $state<Record<string, string>>({})
let executedHash = $state<Record<string, string>>({})

async function load() {
  if (!passkey) return
  const result = await callApi<{ canSign: boolean; approvals: Approval[] }>(
    '/api/approvals',
    passkey,
  )
  canSign = result.canSign
  approvals = result.approvals
}

onMount(async () => {
  passkey = loadPasskey()
  if (!passkey) {
    error = 'この端末にパスキーがありません'
    return
  }
  try {
    await load()
  } catch (e) {
    console.error(e)
    error = e instanceof Error ? e.message : '読み込めませんでした'
  }
})

async function run(id: string, action: () => Promise<void>) {
  busyId = id
  actionError = { ...actionError, [id]: '' }
  try {
    await action()
    await load()
  } catch (e) {
    console.error(e)
    actionError = {
      ...actionError,
      [id]: e instanceof Error ? e.message : '失敗しました',
    }
  } finally {
    busyId = ''
  }
}

function handleSign(item: Approval) {
  const key = passkey
  if (!key) return
  return run(item.id, async () => {
    const { signatureCount, threshold } = await signApproval(
      key,
      item.id,
      item.safeTxHash as Hex,
    )
    // 自分の署名でしきい値に届いたら、そのまま実行まで送る
    if (signatureCount >= threshold) {
      executedHash = {
        ...executedHash,
        [item.id]: await executeApproval(key, item.id),
      }
    }
  })
}

function handleExecute(item: Approval) {
  const key = passkey
  if (!key) return
  return run(item.id, async () => {
    executedHash = {
      ...executedHash,
      [item.id]: await executeApproval(key, item.id),
    }
  })
}

function formatAmount(item: Approval) {
  if (!item.amount || !item.token) return null
  return `${Number(formatUnits(BigInt(item.amount), item.token.decimals)).toLocaleString('ja-JP', { maximumFractionDigits: 6 })} ${item.token.symbol}`
}

function short(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}
</script>

<svelte:head>
	<title>承認 | bizzet</title>
</svelte:head>

<div class="bg-muted/30 min-h-svh">
	<header class="bg-background border-b px-6 py-4">
		<div class="mx-auto max-w-2xl">
			<span class="font-semibold">承認</span>
		</div>
	</header>

	<main class="mx-auto flex max-w-2xl flex-col gap-4 p-6">
		{#if error}
			<p class="text-destructive text-sm">{error}</p>
		{:else if !approvals}
			<p class="text-muted-foreground text-sm">読み込み中…</p>
		{:else if !canSign}
			<p class="text-muted-foreground text-sm">承認は本部の Owner と Approver だけが行えます</p>
		{:else if approvals.length === 0 && Object.keys(executedHash).length === 0}
			<p class="text-muted-foreground text-sm">署名を待っている提案はありません</p>
		{/if}

		{#each Object.entries(executedHash) as [id, hash] (id)}
			<p class="text-sm">
				実行しました：
				<a
					href={`https://sepolia.etherscan.io/tx/${hash}`}
					target="_blank"
					rel="noreferrer"
					class="font-mono underline">{short(hash)}</a
				>
			</p>
		{/each}

		{#each approvals ?? [] as item (item.id)}
			<Card.Root>
				<Card.Header>
					<Card.Title>{kindLabel[item.kind]}{formatAmount(item) ? `：${formatAmount(item)}` : ''}</Card.Title>
					<Card.Description>
						{item.groupName} · ノンス {item.nonce} · {new Date(item.createdAt).toLocaleString('ja-JP')}
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-3">
					<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						{#if item.recipient}
							<dt class="text-muted-foreground">宛先</dt>
							<dd class="font-mono break-all">{item.recipient}</dd>
						{/if}
						{#if item.description}
							<dt class="text-muted-foreground">内容</dt>
							<dd>{item.description}</dd>
						{/if}
						<dt class="text-muted-foreground">呼び出し先</dt>
						<dd class="font-mono break-all">{item.to}</dd>
						<dt class="text-muted-foreground">データ</dt>
						<dd class="font-mono break-all">{short(item.data)}</dd>
						<dt class="text-muted-foreground">署名</dt>
						<dd class="tabular-nums">{item.signatureCount} / {item.threshold ?? '—'}</dd>
					</dl>
					{#if item.unsignable === null}
						<Button onclick={() => handleSign(item)} disabled={busyId !== ''}>
							<FingerprintIcon data-icon="inline-start" />
							{busyId === item.id ? '処理中…' : '承認'}
						</Button>
					{:else if item.executable}
						<Button onclick={() => handleExecute(item)} disabled={busyId !== ''}>
							<SendIcon data-icon="inline-start" />
							{busyId === item.id ? '送信中…' : '実行する'}
						</Button>
					{:else}
						<p class="text-muted-foreground text-sm">{unsignableLabel[item.unsignable]}</p>
					{/if}
					{#if actionError[item.id]}
						<p class="text-destructive text-sm">{actionError[item.id]}</p>
					{/if}
				</Card.Content>
			</Card.Root>
		{/each}
	</main>
</div>
