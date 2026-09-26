<script lang="ts">
import { BottomNav } from '@/components/bottom-nav/index.js'
import { page } from '$app/state'
import favicon from '$lib/assets/favicon.svg'
import './layout.css'

let { children } = $props()

const showBottomNav = $derived(
  page.url.pathname !== '/login' && !page.url.pathname.startsWith('/invite'),
)
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class={showBottomNav ? 'pb-16' : ''}>
	{@render children()}
</div>

{#if showBottomNav}
	<div class="fixed inset-x-0 bottom-0">
		<BottomNav />
	</div>
{/if}
