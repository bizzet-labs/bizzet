<script lang="ts" module>
import type { Component } from 'svelte'

export type NavItem = {
  title: string
  url: string
  icon: Component
}
</script>

<script lang="ts">
import * as Sidebar from '@/components/ui/sidebar/index.js'
import { page } from '$app/state'

let { items }: { items: NavItem[] } = $props()

// ホームは完全一致、それ以外は配下の画面（例：/members/new）でも選択中にする
function isActive(url: string) {
  const { pathname } = page.url
  return url === '/' ? pathname === '/' : pathname === url || pathname.startsWith(`${url}/`)
}
</script>

<Sidebar.Group>
	<Sidebar.Menu>
		{#each items as item (item.url)}
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					isActive={isActive(item.url)}
					tooltipContent={item.title}
				>
					{#snippet child({ props })}
						<a href={item.url} {...props}>
							<item.icon />
							<span>{item.title}</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		{/each}
	</Sidebar.Menu>
</Sidebar.Group>
