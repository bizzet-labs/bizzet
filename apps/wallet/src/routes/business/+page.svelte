<script lang="ts">
import BanknoteArrowDownIcon from '@lucide/svelte/icons/banknote-arrow-down'
import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
import PenLineIcon from '@lucide/svelte/icons/pen-line'
import * as Card from '@/components/ui/card/index.js'

// 承認は本部の Owner と Approver 向け。それ以外のメンバーには承認の画面でその旨を出す
const menuItems = [
  { href: '/business/refund', label: '返金', icon: BanknoteArrowDownIcon },
  { href: '/business/approvals', label: '承認', icon: PenLineIcon },
]
</script>

<svelte:head>
	<title>業務 | bizzet</title>
</svelte:head>

<div class="bg-muted/30 min-h-svh">
	<header class="bg-background border-b px-6 py-4">
		<div class="mx-auto max-w-2xl">
			<span class="font-semibold">業務</span>
		</div>
	</header>

	<main class="mx-auto max-w-2xl p-6">
		<Card.Root class="py-2">
			<Card.Content class="flex flex-col px-0">
				{#each menuItems as item, i (item.href)}
					<a
						href={item.href}
						class="hover:bg-muted/50 flex items-center gap-3 px-6 py-3 {i > 0 ? 'border-t' : ''}"
					>
						<item.icon class="text-muted-foreground size-5" />
						<span class="flex-1 font-medium">{item.label}</span>
						<ChevronRightIcon class="text-muted-foreground size-4" />
					</a>
				{/each}
			</Card.Content>
		</Card.Root>
	</main>
</div>
