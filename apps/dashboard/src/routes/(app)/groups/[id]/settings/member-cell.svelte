<script lang="ts">
let { label, email }: { label: string; email: string } = $props()
</script>

<div class="flex flex-col">
	<span class="font-medium">{label}</span>
	{#if label !== email}
		<span class="text-muted-foreground text-xs">{email}</span>
	{/if}
</div>
