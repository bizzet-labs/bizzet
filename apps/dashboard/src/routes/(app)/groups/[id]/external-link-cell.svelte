<script lang="ts">
import ExternalLinkIcon from '@lucide/svelte/icons/external-link'

// エクスプローラーへのリンク。表の中で幅を取らないよう、短くした文字列を出す
let { href, text, label }: { href: string; text: string; label: string } =
  $props()
</script>

<a
	{href}
	target="_blank"
	rel="noopener noreferrer"
	title={label}
	class="inline-flex items-center gap-1 font-mono text-xs underline-offset-4 hover:underline"
>
	{text}
	<ExternalLinkIcon class="size-3" />
</a>
