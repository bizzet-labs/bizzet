<script lang="ts">
let { data } = $props()
</script>

<svelte:head>
	<title>ホーム | bizzet</title>
</svelte:head>

<main class="flex flex-col gap-6 p-6 pt-0">
	{#if data.member}
		<p class="text-muted-foreground text-sm">
			{data.member.email}（{data.groupName} / {data.member.role}）としてログイン中
		</p>
	{/if}
</main>
