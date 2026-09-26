<script lang="ts">
import { BottomNav } from '@/components/bottom-nav/index.js'
import { page } from '$app/state'
import favicon from '$lib/assets/favicon.png'
import './layout.css'

let { children, data } = $props()

const showBottomNav = $derived(
  page.url.pathname !== '/login' &&
    !page.url.pathname.startsWith('/invite') &&
    // 値札からの支払いはログインなしで使う客向けのページのため、ウォレットのナビを出さない
    !page.url.pathname.startsWith('/pay'),
)
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.demoMode}
	<div
		role="status"
		class="sticky top-0 z-50 bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900"
	>
		デモモード：チェーンへの送信・ENS の解決・パスキーの署名は模擬です
	</div>
{/if}

<div class={showBottomNav ? 'pb-16' : ''}>
	{@render children()}
</div>

{#if showBottomNav}
	<div class="fixed inset-x-0 bottom-0">
		<BottomNav />
	</div>
{/if}
