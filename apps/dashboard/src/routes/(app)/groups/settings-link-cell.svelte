<script lang="ts">
import SettingsIcon from '@lucide/svelte/icons/settings'
import { Button } from '@/components/ui/button/index.js'
import { m } from '$lib/paraglide/messages.js'

let { id }: { id: string } = $props()
</script>

<div class="flex justify-end">
	<Button href="/groups/{id}/settings" variant="ghost" size="sm">
		<SettingsIcon data-icon="inline-start" />
		{m.groups_settings_link()}
	</Button>
</div>
