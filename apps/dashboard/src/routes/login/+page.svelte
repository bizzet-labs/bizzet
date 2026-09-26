<script lang="ts">
import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard'
import LoginForm from '@/components/login-form.svelte'
import * as Card from '@/components/ui/card/index.js'

let { form } = $props()
</script>

<svelte:head>
	<title>ログイン | bizzet</title>
</svelte:head>

<main class="bg-muted/30 flex min-h-svh flex-col items-center justify-center gap-6 p-6">
	<span class="text-lg font-semibold">bizzet</span>
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="items-center text-center">
			<div class="bg-primary/10 text-primary mx-auto mb-2 flex size-12 items-center justify-center rounded-full">
				<LayoutDashboardIcon class="size-6" />
			</div>
			<Card.Title class="text-xl font-semibold">ログイン</Card.Title>
		</Card.Header>
		<Card.Content>
			<LoginForm email={form?.email} message={form?.message} />
		</Card.Content>
	</Card.Root>
</main>
