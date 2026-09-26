<script lang="ts">
import { Button } from '@/components/ui/button/index.js'
import { enhance } from '$app/forms'

let { token }: { token: string } = $props()
</script>

<form method="POST" action="?/revoke" use:enhance class="flex justify-end">
	<input type="hidden" name="token" value={token} />
	<Button type="submit" variant="ghost" size="sm" class="text-destructive">取り消す</Button>
</form>
