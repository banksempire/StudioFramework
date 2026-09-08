<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    title?: string;
  }>(),
  { min: 1, max: 100, step: 1, disabled: false, title: undefined },
);

const emit = defineEmits<(e: 'update:modelValue', value: number) => void>();

const boxValue = computed(() => (Number.isFinite(props.modelValue) ? String(props.modelValue) : ''));

function clamp(n: number): number {
  return Math.min(props.max, Math.max(props.min, n));
}

function onRange(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value));
}

function onBoxInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const n = Number(raw);
  if (raw !== '' && Number.isFinite(n)) emit('update:modelValue', n);
}

function onBoxChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const raw = input.value;
  const n = Number(raw);
  const next = clamp(raw === '' || !Number.isFinite(n) ? props.modelValue : Math.round(n));
  input.value = String(next);
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="sf-slider-input" :class="{ 'sf-slider-input--disabled': disabled }">
    <input
      class="sf-slider-input-range"
      type="range"
      :value="clamp(modelValue)"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :title="title"
      @input="onRange"
    />
    <input
      class="sf-slider-input-box"
      type="number"
      :value="boxValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :title="title"
      @input="onBoxInput"
      @change="onBoxChange"
    />
  </div>
</template>

<style scoped>
.sf-slider-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sf-slider-input--disabled {
  opacity: 0.6;
}

.sf-slider-input-range {
  width: 110px;
  accent-color: var(--sf-accent);
  cursor: pointer;
}

.sf-slider-input-box {
  box-sizing: border-box;
  width: 52px;
  padding: 4px 6px;
  background: var(--sf-bg);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  color: var(--sf-text);
  font-family: var(--sf-mono);
  font-size: 16px;
  text-align: center;
  outline: none;
  appearance: textfield;
  -moz-appearance: textfield;
}

.sf-slider-input-box::-webkit-outer-spin-button,
.sf-slider-input-box::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.sf-slider-input-box:hover,
.sf-slider-input-box:focus {
  border-color: var(--sf-accent);
}
</style>
