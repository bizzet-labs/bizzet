<script setup>
import { ref } from 'vue'

const props = defineProps({
  customerLabel: { type: String, default: '🧑<br />客' },
  storeLabel: { type: String, default: '🏪<br />店舗のウォレット' },
  hqLabel: { type: String, default: '🏢<br />本部のウォレット' },
  buttonLabel: { type: String, default: '▶ 支払いの流れを再生' },
})

// クリックのたびに :key を変えて .dot を再マウントし、CSS アニメーションを最初から再生する
const run = ref(0)
function play() {
  run.value++
}
</script>

<template>
  <div class="flow-diagram">
    <div class="node" v-html="props.customerLabel" />
    <div class="arrow" />
    <div class="node" v-html="props.storeLabel" />
    <div class="arrow" />
    <div class="node hq" v-html="props.hqLabel" />
    <div class="track">
      <div v-if="run > 0" :key="run" class="dot" />
    </div>
  </div>
  <button class="play-btn" @click="play">{{ props.buttonLabel }}</button>
</template>

<style scoped>
.flow-diagram {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  padding: 48px 0 28px;
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
.track {
  position: absolute;
  left: 14%;
  right: 14%;
  top: 50%;
  height: 0;
}
.dot {
  position: absolute;
  top: -9px;
  left: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f59e0b;
  box-shadow: 0 0 0 4px color-mix(in srgb, #f59e0b 25%, transparent);
  animation: go 2.4s ease-in-out forwards;
}
@keyframes go {
  0% {
    left: 0;
  }
  45% {
    left: calc(50% - 9px);
  }
  55% {
    left: calc(50% - 9px);
  }
  100% {
    left: calc(100% - 18px);
  }
}
.play-btn {
  display: block;
  margin: 0 auto;
  padding: 6px 18px;
  border-radius: 999px;
  border: 1px solid var(--slidev-theme-primary, #5b21b6);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
}
.play-btn:hover {
  background: color-mix(in srgb, var(--slidev-theme-primary, #5b21b6) 10%, transparent);
}
</style>
