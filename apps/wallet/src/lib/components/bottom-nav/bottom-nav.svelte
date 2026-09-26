<script lang="ts">
import BriefcaseIcon from '@lucide/svelte/icons/briefcase'
import HomeIcon from '@lucide/svelte/icons/home'
import UserRoundIcon from '@lucide/svelte/icons/user-round'
import { cn } from '@/utils.js'
import { page } from '$app/state'

const items = [
  { href: '/', label: 'ホーム', icon: HomeIcon },
  { href: '/business', label: '業務', icon: BriefcaseIcon },
  { href: '/mypage', label: 'マイページ', icon: UserRoundIcon },
]
</script>

<nav class="bg-background border-t px-2 py-1" aria-label="メインメニュー">
	<div class="mx-auto flex max-w-2xl items-center justify-around">
		{#each items as item (item.href)}
			{@const isActive = page.url.pathname === item.href}
			<a
				href={item.href}
				class={cn(
					'flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs',
					isActive ? 'text-primary' : 'text-muted-foreground',
				)}
			>
				<item.icon class="size-5" />
				{item.label}
			</a>
		{/each}
	</div>
</nav>
