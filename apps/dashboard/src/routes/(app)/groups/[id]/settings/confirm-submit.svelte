<script lang="ts">
import * as AlertDialog from '@/components/ui/alert-dialog/index.js'
import { Button } from '@/components/ui/button/index.js'
import { m } from '$lib/paraglide/messages.js'

// 取り消せない確定の前に確認を挟むボタン。ダイアログは form の外に描かれるため、
// 確定のボタンは form 属性で対象のフォームを指して送信する
let {
  formId,
  label,
  title,
  description,
  disabled = false,
}: {
  formId: string
  label: string
  title: string
  description: string
  disabled?: boolean
} = $props()
</script>

<AlertDialog.Root>
	<AlertDialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} {disabled}>{label}</Button>
		{/snippet}
	</AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>{description}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action type="submit" form={formId}>{m.groups_confirm()}</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
