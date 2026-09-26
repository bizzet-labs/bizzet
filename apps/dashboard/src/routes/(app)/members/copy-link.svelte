<script lang="ts">
import CheckIcon from '@lucide/svelte/icons/check'
import CopyIcon from '@lucide/svelte/icons/copy'
import { Button } from '@/components/ui/button/index.js'
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field/index.js'
import { Input } from '@/components/ui/input/index.js'
import { m } from '$lib/paraglide/messages.js'

// 招待や追加用リンクの URL を、読み取り専用の欄とコピーのボタンで見せる
let {
  id,
  label,
  description,
  url,
}: { id: string; label: string; description?: string; url: string } = $props()

let copied = $state(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(url)
    copied = true
    setTimeout(() => {
      copied = false
    }, 2000)
  } catch {
    // クリップボードを使えない環境では、欄から手で選んでコピーしてもらう
  }
}
</script>

<Field>
	<FieldLabel for={id}>{label}</FieldLabel>
	<div class="flex gap-2">
		<Input {id} value={url} readonly class="font-mono text-xs" onfocus={(e) => e.currentTarget.select()} />
		<Button type="button" variant="outline" size="icon" aria-label={m.members_copy()} onclick={copy}>
			{#if copied}
				<CheckIcon />
			{:else}
				<CopyIcon />
			{/if}
		</Button>
	</div>
	{#if description}
		<FieldDescription>{description}</FieldDescription>
	{/if}
</Field>
