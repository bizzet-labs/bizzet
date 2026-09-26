<script lang="ts">
let { text, title }: { text: string; title?: string } = $props()
</script>

<span class="font-mono text-xs" {title}>{text}</span>
