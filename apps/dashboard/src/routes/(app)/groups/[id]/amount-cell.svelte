<script lang="ts">
import { formatTokenAmount } from '$lib/format'

let {
  amount,
  decimals,
  symbol,
}: { amount: string; decimals: number; symbol: string } = $props()
</script>

<span class="font-medium tabular-nums">{formatTokenAmount(amount, decimals)}</span>
<span class="text-muted-foreground text-xs">{symbol}</span>
