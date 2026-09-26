<script lang="ts">
import CircleIcon from '@lucide/svelte/icons/circle'
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle'
import type { SwapStep } from '@/swap.js'

// 交換して支払うときの、ウォレットで承認する取引の並びと進み具合
let {
  steps,
  stepIndex,
  confirming,
  waiting,
}: {
  steps: SwapStep[]
  stepIndex: number
  confirming: boolean
  waiting: 'wallet' | 'block'
} = $props()

const SWAP_STEP_LABELS: Record<SwapStep, string> = {
  erc20Approve: 'Permit2 に通貨の利用を許可',
  permit2Approve: 'Uniswap のルーターに Permit2 で許可',
  swap: 'Uniswap v4 で交換して支払う',
}
</script>

<ol class="flex flex-col gap-1.5 text-sm">
	{#each steps as step, i (step)}
		<li class="flex items-center gap-2">
			{#if i < stepIndex}
				<CircleCheckIcon class="size-4 text-emerald-600" />
			{:else if i === stepIndex && confirming}
				<LoaderCircleIcon class="size-4 animate-spin" />
			{:else}
				<CircleIcon class="text-muted-foreground size-4" />
			{/if}
			<span class={i > stepIndex ? 'text-muted-foreground' : ''}>
				{i + 1}. {SWAP_STEP_LABELS[step]}
			</span>
			{#if i === stepIndex && confirming}
				<span class="text-muted-foreground ml-auto text-xs">
					{waiting === 'wallet' ? 'ウォレットで承認' : 'ブロック待ち'}
				</span>
			{/if}
		</li>
	{/each}
</ol>
