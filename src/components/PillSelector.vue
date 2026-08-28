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
  --sf-pill-gap: 4px;
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--sf-pill-gap);
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--sf-border);
  background: rgba(0, 0, 0, 0.15);
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
}
.sf-pill-item {
  padding: 4px 14px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-family: inherit;
  cursor: pointer;
  opacity: 0.75;
  white-space: nowrap;
  flex-shrink: 0;
}
.sf-pill-item:hover {
  opacity: 1;
}
.sf-pill-item:focus-visible {
  outline: 2px solid var(--sf-accent-dim);
  outline-offset: 1px;
}
.sf-pill-item--on {
  background: var(--sf-accent-soft);
  color: var(--sf-text-bright);
  opacity: 1;
}

@container (max-width: 640px) {
  .sf-pill-track {
    --sf-pill-gap: 3px;
  }
  .sf-pill-item {
    padding: 4px 9px;
  }
}
@container (max-width: 540px) {
  .sf-pill-track {
    --sf-pill-gap: 2px;
  }
  .sf-pill-item {
    padding: 3px 6px;
  }
}
@container (max-width: 490px) {
  .sf-pill-track {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    max-width: 100%;
  }
  .sf-pill-item {
    flex-shrink: 0;
  }
}
</style>
