<script lang="ts">
// 行から詳細へ移れるよう、内容の列を詳細へのリンクにする
let { href, text }: { href: string; text: string } = $props()
</script>

<a {href} class="font-medium underline-offset-4 hover:underline">{text}</a>
