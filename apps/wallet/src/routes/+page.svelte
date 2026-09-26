<script lang="ts">
import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
import PenLineIcon from '@lucide/svelte/icons/pen-line'
import { onMount } from 'svelte'
import { formatUnits } from 'viem'
import { callApi } from '@/approvals.js'
import * as Card from '@/components/ui/card/index.js'
import { loadPasskey } from '@/passkey.js'

type Home = {
  member: { name: string | null; email: string; role: string }
  tokens: { symbol: 'JPYC' | 'USDC'; decimals: number }[]
  balancesError: boolean
  groups: {
    id: string
    name: string
    kind: 'headquarters' | 'store'
    safeAddress: string | null
    balances: Record<string, string | null> | null
  }[]
  pendingCount: number
  canSign: boolean
}

let home = $state<Home | null>(null)
let error = $state('')

onMount(async () => {
  const passkey = loadPasskey()
  if (!passkey) {
    error =
      'この端末にパスキーがありません。招待か追加用のリンクから登録してください'
    return
  }
  try {
    home = await callApi<Home>('/api/home', passkey)
  } catch (e) {
    console.error(e)
    error = e instanceof Error ? e.message : '読み込めませんでした'
  }
})

function formatBalance(value: string | null | undefined, decimals: number) {
  if (value === null || value === undefined) return '—'
  return Number(formatUnits(BigInt(value), decimals)).toLocaleString('ja-JP', {
    maximumFractionDigits: 2,
  })
}
</script>

<svelte:head>
	<title>ホーム | bizzet</title>
</svelte:head>

<div class="bg-muted/30 min-h-svh">
	<header class="bg-background border-b px-6 py-4">
		<div class="mx-auto max-w-2xl">
			<span class="font-semibold">bizzet</span>
		</div>
	</header>

	<main class="mx-auto flex max-w-2xl flex-col gap-4 p-6">
		{#if error}
			<p class="text-destructive text-sm">{error}</p>
		{:else if !home}
			<p class="text-muted-foreground text-sm">読み込み中…</p>
		{:else}
			{#if home.canSign}
				<a href="/business/approvals">
					<Card.Root class="hover:bg-muted/50 py-2">
						<Card.Content class="flex items-center gap-3 px-6 py-2">
							<PenLineIcon class="text-muted-foreground size-5" />
							<span class="flex-1 font-medium">署名を待っている提案</span>
							<span class="text-lg font-semibold tabular-nums">{home.pendingCount} 件</span>
							<ChevronRightIcon class="text-muted-foreground size-4" />
						</Card.Content>
					</Card.Root>
				</a>
			{/if}

			{#if home.balancesError}
				<p class="text-destructive text-sm">残高を読み込めませんでした</p>
			{/if}

			{#each home.groups as group (group.id)}
				<Card.Root>
					<Card.Header>
						<Card.Title>{group.name}</Card.Title>
						<Card.Description>
							{group.kind === 'headquarters' ? '本部' : '店舗'}
							{#if group.safeAddress}
								·
								<a
									href={`https://sepolia.etherscan.io/address/${group.safeAddress}`}
									target="_blank"
									rel="noreferrer"
									class="font-mono text-xs underline"
								>
									{group.safeAddress.slice(0, 6)}…{group.safeAddress.slice(-4)}
								</a>
							{/if}
						</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if !group.safeAddress}
							<p class="text-muted-foreground text-sm">Safe はまだ設定されていません</p>
						{:else}
							<dl class="grid grid-cols-2 gap-3">
								{#each home.tokens as token (token.symbol)}
									<div class="flex flex-col">
										<dt class="text-muted-foreground text-xs">{token.symbol}</dt>
										<dd class="text-xl font-semibold tabular-nums">
											{formatBalance(group.balances?.[token.symbol], token.decimals)}
										</dd>
									</div>
								{/each}
							</dl>
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		{/if}
	</main>
</div>
