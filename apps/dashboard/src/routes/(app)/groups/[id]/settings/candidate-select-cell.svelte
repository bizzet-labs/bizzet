<script lang="ts">
import { m } from '$lib/paraglide/messages.js'

// 表はフォームの外に描かれるため、form 属性で本部の Safe の設定のフォームに含める
let {
  id,
  label,
  formId,
  disabled,
}: { id: string; label: string; formId: string; disabled: boolean } = $props()
</script>

<input
	type="checkbox"
	name="owner"
	value={id}
	form={formId}
	checked={!disabled}
	{disabled}
	aria-label={`${m.groups_candidate_column_select()}: ${label}`}
	class="accent-primary size-4 align-middle"
/>
