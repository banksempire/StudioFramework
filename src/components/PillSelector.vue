<script setup lang="ts">
defineProps<{
  options: Array<{ value: string | number; label: string; title?: string }>;
  modelValue: string | number;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>();
</script>

<template>
  <div class="sf-pill">
    <div class="sf-pill-track" role="group">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="sf-pill-item"
        :class="{ 'sf-pill-item--on': opt.value === modelValue }"
        :title="opt.title ?? opt.label"
        :aria-pressed="opt.value === modelValue"
        @click="emit('update:modelValue', opt.value)"
      >{{ opt.label }}</button>
    </div>
  </div>
</template>

<style scoped>
.sf-pill {
  max-width: 100%;
  container-type: inline-size;
}
.sf-pill-track {
  --sf-pill-gap: 5px;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--sf-pill-gap);
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--sf-border);
  background: rgba(0, 0, 0, 0.15);
  width: 100%;
  height: 36px;
  box-sizing: border-box;
}
.sf-pill-item {
  position: relative;
  isolation: isolate;
  flex: 1 1 0;
  min-width: fit-content;
  align-self: stretch;
  padding: 0;
  line-height: 1;
  text-align: center;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-family: inherit;
  cursor: pointer;
  opacity: 0.75;
  white-space: nowrap;
}
.sf-pill-item:hover {
  opacity: 1;
}
.sf-pill-item:focus-visible {
  outline: 2px solid var(--sf-accent-dim);
  outline-offset: 1px;
}
.sf-pill-item--on {
  color: var(--sf-text-bright);
  opacity: 1;
}
.sf-pill-item--on::before {
  content: '';
  position: absolute;
  z-index: -1;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--sf-accent-soft);
  border: 1px solid var(--sf-accent-dim);
  border-radius: 999px;
}

@container (max-width: 490px) {
  .sf-pill-track {
    flex-wrap: wrap;
    overflow-x: hidden;
    height: auto;
    min-height: 36px;
  }
}
</style>
