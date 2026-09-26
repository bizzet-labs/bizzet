<script lang="ts">
import DemoPay from './demo-pay.svelte'
import RealPay from './real-pay.svelte'

let { data } = $props()
</script>

{#if data.demoMode}
	<DemoPay resolution={data.demoResolution} />
{:else}
	<RealPay />
{/if}
