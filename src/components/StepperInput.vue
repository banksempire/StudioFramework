<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from './SvgIcon.vue';

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

function adjust(dir: number) {
  const base = Number.isFinite(props.modelValue) ? props.modelValue : props.min;
  emit('update:modelValue', clamp(base + dir * props.step));
}
</script>

<template>
  <div class="sf-stepper-input" :class="{ 'sf-stepper-input--disabled': disabled }">
    <input
      class="sf-stepper-input-box"
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
    <div class="sf-stepper-input-btns">
      <button
        class="sf-stepper-input-btn"
        type="button"
        tabindex="-1"
        title="Increase"
        :disabled="disabled"
        @click="adjust(1)"
      >
        <SvgIcon name="⌃" />
      </button>
      <button
        class="sf-stepper-input-btn"
        type="button"
        tabindex="-1"
        title="Decrease"
        :disabled="disabled"
        @click="adjust(-1)"
      >
        <SvgIcon name="⌄" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.sf-stepper-input {
  display: flex;
  align-items: stretch;
}

.sf-stepper-input--disabled {
  opacity: 0.6;
}

.sf-stepper-input-box {
  box-sizing: border-box;
  width: 52px;
  padding: 4px 6px;
  background: var(--sf-bg);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm) 0 0 var(--sf-radius-sm);
  color: var(--sf-text);
  font-family: var(--sf-mono);
  font-size: 16px;
  text-align: center;
  outline: none;
  appearance: textfield;
  -moz-appearance: textfield;
}

.sf-stepper-input-box::-webkit-outer-spin-button,
.sf-stepper-input-box::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.sf-stepper-input-box:hover,
.sf-stepper-input-box:focus {
  border-color: var(--sf-accent);
}

.sf-stepper-input-btns {
  display: flex;
  flex-direction: column;
  width: 20px;
}

.sf-stepper-input-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--sf-border);
  border-left: none;
  background: var(--sf-bg-lighter);
  color: var(--sf-text-muted);
  cursor: pointer;
}

.sf-stepper-input-btn:first-child {
  border-radius: 0 var(--sf-radius-sm) 0 0;
  border-bottom: none;
}

.sf-stepper-input-btn:last-child {
  border-radius: 0 0 var(--sf-radius-sm) 0;
}

@media (hover: hover) {
  .sf-stepper-input-btn:hover {
    color: var(--sf-text-bright);
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
  }
}

.sf-stepper-input-btn:active {
  color: var(--sf-accent);
}
</style>
