<script lang="ts">
import FingerprintIcon from '@lucide/svelte/icons/fingerprint'
import { Hex, Signature, WebAuthnP256 } from 'ox'
import { Button } from '@/components/ui/button/index.js'
import { Field, FieldGroup } from '@/components/ui/field/index.js'
import { cn } from '@/utils.js'
import { enhance } from '$app/forms'
import { env } from '$env/dynamic/public'

let {
  challenge,
  message,
  class: className,
}: { challenge: Hex.Hex; message?: string; class?: string } = $props()

let pending = $state(false)
let error = $state('')
let formEl: HTMLFormElement

// 端末に登録済みのパスキーでチャレンジに署名し、サーバーで検証してもらう
async function handleLogin() {
  pending = true
  error = ''
  try {
    const { raw, metadata, signature } = await WebAuthnP256.sign({
      challenge,
      rpId: env.PUBLIC_PASSKEY_RP_ID || undefined,
    })
    const response = {
      credentialId: raw.id,
      metadata,
      signature: Signature.toHex(signature),
    }
    ;(formEl.elements.namedItem('response') as HTMLInputElement).value =
      JSON.stringify(response)
    formEl.requestSubmit()
  } catch (e) {
    console.error(e)
    error = 'パスキーでログインできませんでした'
    pending = false
  }
}
</script>

<div class={cn("flex flex-col gap-6", className)}>
	<FieldGroup>
		<div class="flex flex-col items-center gap-1 text-center">
			<h1 class="text-2xl font-bold">ダッシュボードにログイン</h1>
			<p class="text-sm text-balance text-muted-foreground">
				ウォレットで登録したパスキーでログインします
			</p>
		</div>
		<form
			method="POST"
			bind:this={formEl}
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type !== 'redirect') pending = false
					await update()
				}
			}}
		>
			<input type="hidden" name="response" />
		</form>
		<Field>
			<Button size="lg" onclick={handleLogin} disabled={pending}>
				<FingerprintIcon data-icon="inline-start" />
				パスキーでログイン
			</Button>
		</Field>
		{#if error || message}
			<p class="text-destructive text-center text-sm">{error || message}</p>
		{/if}
		<p class="text-center text-sm text-muted-foreground">
			パスキーの登録は、管理者からの招待リンクからウォレットで行います
		</p>
	</FieldGroup>
</div>
