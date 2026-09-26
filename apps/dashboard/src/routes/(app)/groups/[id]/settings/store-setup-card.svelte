<script lang="ts">
import InfoIcon from '@lucide/svelte/icons/info'
import * as Alert from '@/components/ui/alert/index.js'
import * as Card from '@/components/ui/card/index.js'
import { enhance } from '$app/forms'
import { m } from '$lib/paraglide/messages.js'
import ConfirmSubmit from './confirm-submit.svelte'

// 店舗の Safe の設定の確定。本部の Safe が設定済みのときだけ確定できる
let {
  headquartersConfigured,
  canManage,
}: {
  headquartersConfigured: boolean
  canManage: boolean
} = $props()

const STORE_FORM_ID = 'configure-store'
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.groups_store_setup_title()}</Card.Title>
		<Card.Description>{m.groups_store_setup_description()}</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if !headquartersConfigured}
			<Alert.Root>
				<InfoIcon />
				<Alert.Title>{m.groups_error_hq_unconfigured()}</Alert.Title>
				<Alert.Description>{m.groups_store_setup_hq_unconfigured()}</Alert.Description>
			</Alert.Root>
		{:else if canManage}
			<form id={STORE_FORM_ID} method="POST" action="?/configureStore" use:enhance class="flex justify-end">
				<ConfirmSubmit
					formId={STORE_FORM_ID}
					label={m.groups_store_setup_submit()}
					title={m.groups_store_setup_confirm_title()}
					description={m.groups_store_setup_confirm_description()}
				/>
			</form>
		{:else}
			<p class="text-muted-foreground text-sm">{m.groups_safe_unconfigured_description()}</p>
		{/if}
	</Card.Content>
</Card.Root>
