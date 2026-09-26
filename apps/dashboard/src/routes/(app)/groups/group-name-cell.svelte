<script lang="ts">
let { id, name }: { id: string; name: string } = $props()
</script>

<a href="/groups/{id}" class="font-medium underline-offset-4 hover:underline">{name}</a>
