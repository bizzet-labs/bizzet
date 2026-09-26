<script setup>
defineProps({
  from: { type: String, required: true },
  to: { type: String, required: true },
  seconds: { type: Number, required: true },
  unit: { type: String, default: '秒' },
})
</script>

<template>
  <span class="time-chip">{{ from }}–{{ to }}<span class="dot">・</span>{{ seconds }}{{ unit }}</span>
</template>

<style scoped>
.time-chip {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.85em;
  color: var(--slidev-theme-primary, #5b21b6);
  background: color-mix(in srgb, var(--slidev-theme-primary, #5b21b6) 12%, transparent);
  border-radius: 999px;
  padding: 4px 14px;
}
.dot {
  margin: 0 4px;
  opacity: 0.6;
}
</style>
