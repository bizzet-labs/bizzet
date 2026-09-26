<script lang="ts">
import AppSidebar from '@/components/app-sidebar.svelte'
import { Separator } from '@/components/ui/separator/index.js'
import * as Sidebar from '@/components/ui/sidebar/index.js'
import { page } from '$app/state'

let { data, children } = $props()

// ヘッダーに出す、今いる画面の名前
const TITLES: Record<string, string> = {
  '/': 'ホーム',
  '/members': 'メンバー',
  '/members/new': 'メンバーの招待',
}
const title = $derived(TITLES[page.url.pathname] ?? '')
</script>

{#if data.member}
	<Sidebar.Provider>
		<AppSidebar member={data.member} groupName={data.groupName} />
		<Sidebar.Inset>
			<header
				class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
			>
				<div class="flex items-center gap-2 px-4">
					<Sidebar.Trigger class="-ms-1" />
					<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
					<span class="text-sm font-medium">{title}</span>
				</div>
			</header>
			<div class="flex flex-1 flex-col">
				{@render children()}
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
{/if}
