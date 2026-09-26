<script lang="ts">
import * as AlertDialog from '@/components/ui/alert-dialog/index.js'
import { Button, buttonVariants } from '@/components/ui/button/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'

let { laterOpenCount }: { laterOpenCount: number } = $props()

let open = $state(false)
let submitting = $state(false)
</script>

<!-- 却下は取り消せないため、確認してから送る -->
<AlertDialog.Root bind:open>
	<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
		{m.transactions_reject()}
	</AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.transactions_reject_confirm_title()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.transactions_reject_confirm_description()}
				{#if laterOpenCount > 0}
					{m.transactions_reject_later_warning({ count: laterOpenCount })}
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<form
			method="POST"
			action="?/reject"
			use:enhance={() => {
				submitting = true
				return async ({ update }) => {
					submitting = false
					open = false
					await update()
				}
			}}
		>
			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button">{m.common_cancel()}</AlertDialog.Cancel>
				<Button type="submit" variant="destructive" disabled={submitting}>
					{m.transactions_reject()}
				</Button>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
