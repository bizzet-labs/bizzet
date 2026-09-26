<script lang="ts">
import type { ReceivingCurrency } from '@bizzet/contracts'
import * as Card from '@/components/ui/card/index.js'
import { DEMO_JPY_PER_USD, formatTokenAmount, type PriceTag } from '@/pay.js'

// 値札の価格と、受取通貨での支払額・換算のレート
let {
  priceTag,
  amount,
  currency,
  uniswapRate,
}: {
  priceTag: PriceTag
  amount: bigint | null
  currency: ReceivingCurrency | null
  uniswapRate: number | null
} = $props()

function formatYen(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}
</script>

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
