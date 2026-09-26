<script setup>
defineProps({
  customerLabel: { type: String, default: '🧑<br />客' },
  storeLabel: { type: String, default: '🏪<br />店舗のウォレット' },
  hqLabel: { type: String, default: '🏢<br />本部のウォレット' },
})
</script>

<template>
  <div class="flow-diagram">
    <div class="node" v-html="customerLabel" />
    <div class="arrow" />
    <div class="node" v-html="storeLabel" />
    <div class="arrow" />
    <div class="node hq" v-html="hqLabel" />
  </div>
</template>

<style scoped>
.flow-diagram {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0 20px;
}
.node {
  border: 2px solid var(--slidev-theme-primary, #5b21b6);
  border-radius: 14px;
  padding: 14px 18px;
  text-align: center;
  font-size: 0.95rem;
  line-height: 1.5;
  background: color-mix(in srgb, var(--slidev-theme-primary, #5b21b6) 6%, transparent);
  min-width: 120px;
}
.node.hq {
  border-color: #059669;
  background: color-mix(in srgb, #059669 8%, transparent);
}
.arrow {
  width: 44px;
  height: 2px;
  background: #999;
  position: relative;
  flex-shrink: 0;
}
.arrow::after {
  content: '';
  position: absolute;
  right: -1px;
  top: -4px;
  border: 5px solid transparent;
  border-left-color: #999;
}
</style>
