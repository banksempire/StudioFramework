<script setup lang="ts">
import type { PopupOption } from '../types/popup';

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    options: PopupOption[];
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<(e: 'update:modelValue', value: string | number) => void>();

function selected(option: PopupOption): boolean {
  return option.value === props.modelValue;
}

function pick(option: PopupOption) {
  if (props.disabled || selected(option)) return;
  emit('update:modelValue', option.value);
}
</script>

<template>
  <div class="sf-cards" :class="{ 'sf-cards--disabled': disabled }">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      class="sf-card"
      :class="{ 'sf-card--on': selected(opt) }"
      :disabled="disabled"
      @click="pick(opt)"
    >
      <span class="sf-card-title">{{ opt.label }}</span>
      <span v-if="opt.desc" class="sf-card-desc">{{ opt.desc }}</span>
    </button>
  </div>
</template>

<style scoped>
.sf-cards {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.sf-cards--disabled {
  opacity: 0.6;
}

.sf-card {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  padding: 8px 10px;
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius, 8px);
  background: rgba(0, 0, 0, 0.15);
  color: var(--sf-text);
  cursor: pointer;
  text-align: left;
}

.sf-card--on {
  border-color: var(--sf-accent);
  color: var(--sf-text-bright);
}

.sf-card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--sf-text-bright);
}

.sf-card-desc {
  font-size: 16px;
  color: var(--sf-text-muted, var(--sf-text));
}
</style>
