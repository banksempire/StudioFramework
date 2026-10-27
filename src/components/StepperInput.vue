<script setup lang="ts">
import { ref } from 'vue';
import SvgIcon from './SvgIcon.vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    id?: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    title?: string;
    shorthand?: boolean;
  }>(),
  { min: 1, max: 100, step: 1, disabled: false, title: undefined, id: undefined, shorthand: false },
);

const emit = defineEmits<(e: 'update:modelValue', value: number) => void>();

const draft = ref<string | null>(null);

function clamp(n: number): number {
  return Math.min(props.max, Math.max(props.min, n));
}

function trimNumber(n: number): string {
  return String(Number(n.toFixed(6)));
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '';
  if (props.shorthand) {
    if (v >= 1e6 && v % 1e6 === 0) return `${trimNumber(v / 1e6)}m`;
    if (v >= 1e3 && v % 1e3 === 0) return `${trimNumber(v / 1e3)}k`;
  }
  return String(v);
}

function parseDraft(raw: string): number | null {
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^([0-9]*\.?[0-9]+)\s*([km])?$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  return base * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1);
}

function commitDraft(): number {
  const raw = draft.value;
  draft.value = null;
  if (raw === null) return props.modelValue;
  const parsed = parseDraft(raw);
  const next = parsed === null ? props.modelValue : clamp(Math.round(parsed));
  if (next !== props.modelValue) emit('update:modelValue', next);
  return next;
}

function onBoxInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value;
}

function onBoxBlur() {
  commitDraft();
}

function onBoxKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
}

function stepFor(v: number): number {
  if (!props.shorthand || v < 10) return props.step;
  return Math.max(props.step, 10 ** (Math.floor(Math.log10(v)) - 1));
}

function adjust(dir: number) {
  const committed = clamp(Math.round(commitDraft()));
  const next = clamp(committed + dir * stepFor(committed));
  if (next !== committed) emit('update:modelValue', next);
}
</script>

<template>
  <div class="sf-stepper-input" :class="{ 'sf-stepper-input--disabled': disabled }">
    <input
      :id="id"
      class="sf-stepper-input-box"
      :type="shorthand ? 'text' : 'number'"
      :value="draft ?? formatValue(modelValue)"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :title="title"
      @input="onBoxInput"
      @blur="onBoxBlur"
      @keydown="onBoxKeydown"
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
  height: var(--sf-control-h);
  padding: 4px 6px;
  background: var(--sf-bg);
  border: 1px solid var(--sf-border);
  border-radius: 8px 0 0 8px;
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
  border-radius: 0 8px 0 0;
  border-bottom: none;
}

.sf-stepper-input-btn:last-child {
  border-radius: 0 0 8px 0;
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
