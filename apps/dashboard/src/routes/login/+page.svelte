<script lang="ts">
import LoginForm from '@/components/login-form.svelte'
import * as Card from '@/components/ui/card/index.js'
import logoMark from '$lib/assets/logo-mark.png'
import { m } from '$lib/paraglide/messages.js'

let { form } = $props()
</script>

<svelte:head>
	<title>{m.common_title({ page: m.auth_login_title() })}</title>
</svelte:head>

<main class="bg-muted/30 flex min-h-svh flex-col items-center justify-center gap-6 p-6">
	<span class="text-lg font-semibold">bizzet</span>
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="items-center text-center">
			<img src={logoMark} alt="" class="mx-auto mb-2 h-12 w-auto dark:invert" />
			<Card.Title class="text-xl font-semibold">{m.auth_login_title()}</Card.Title>
		</Card.Header>
		<Card.Content>
			<LoginForm email={form?.email} message={form?.message} />
		</Card.Content>
	</Card.Root>
</main>
