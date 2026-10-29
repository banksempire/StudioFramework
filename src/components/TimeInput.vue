<script setup lang="ts">
import { computed, inject, onBeforeUnmount, type Ref, ref, watch } from 'vue';
import { kIsMobile } from '../composables/useWorkspace';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    id?: string;
    disabled?: boolean;
    title?: string;
  }>(),
  { id: undefined, disabled: false, title: undefined },
);

const emit = defineEmits<(e: 'update:modelValue', value: string) => void>();

const injectedMobile = inject<Ref<boolean> | null>(kIsMobile, null);
const isMobile = computed(() => injectedMobile?.value ?? false);

const inputEl = ref<HTMLInputElement | null>(null);

const draft = ref<string | null>(null);

const display = computed(() => draft.value ?? (props.modelValue || ''));

watch(
  () => props.modelValue,
  (v) => {
    if (v !== display.value) draft.value = null;
  },
);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function normalize(raw: string): string | null {
  const t = raw.trim();
  if (!t) return '';
  const clock = /^([0-9]{1,2}):([0-9]{1,2})$/.exec(t);
  const digits = t.replace(/\D+/g, '');
  let h: number;
  let m: number;
  if (clock) {
    h = Number(clock[1]);
    m = Number(clock[2]);
  } else if (digits.length >= 1 && digits.length <= 4) {
    if (digits.length <= 2) {
      h = Number(digits);
      m = 0;
    } else {
      h = Number(digits.slice(0, digits.length - 2));
      m = Number(digits.slice(-2));
    }
  } else {
    return null;
  }
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null;
  return `${pad2(h)}:${pad2(m)}`;
}

function onInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', draft.value);
}

function commit() {
  if (draft.value === null) return;
  const next = normalize(draft.value);
  draft.value = null;
  if (next === null || next === props.modelValue) return;
  emit('update:modelValue', next);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
}

let pickerSwallow: ((e: MouseEvent) => void) | null = null;

function disarmPickerSwallow() {
  if (!pickerSwallow) return;
  window.removeEventListener('mousedown', pickerSwallow, true);
  pickerSwallow = null;
}

function armPickerSwallow() {
  if (pickerSwallow) return;
  pickerSwallow = (e: MouseEvent) => {
    disarmPickerSwallow();
    if (e.target instanceof Node && inputEl.value?.contains(e.target)) return;
    e.stopPropagation();
  };
  window.addEventListener('mousedown', pickerSwallow, true);
}

function onNativeClick() {
  if (props.disabled) return;
  try {
    inputEl.value?.showPicker();
    armPickerSwallow();
  } catch {}
}

function onNativeInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}

onBeforeUnmount(disarmPickerSwallow);
</script>

<template>
  <input
    v-if="isMobile"
    :id="id"
    ref="inputEl"
    class="sf-form-input sf-time-input sf-time-input--native"
    type="time"
    step="60"
    :value="modelValue"
    :disabled="disabled"
    :title="title"
    @input="onNativeInput"
    @change="disarmPickerSwallow"
    @click="onNativeClick"
  />
  <input
    v-else
    :id="id"
    class="sf-form-input sf-time-input"
    type="text"
    inputmode="numeric"
    autocomplete="off"
    spellcheck="false"
    placeholder="hh:mm"
    :value="display"
    :disabled="disabled"
    :title="title"
    @input="onInput"
    @blur="commit"
    @keydown="onKeydown"
  />
</template>

<style scoped>
.sf-time-input {
  width: 84px;
  text-align: center;
  font-family: var(--sf-mono, monospace);
  font-variant-numeric: tabular-nums;
  padding-left: 8px;
  padding-right: 28px;
  cursor: text;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none'><circle cx='12' cy='12' r='9' stroke='%23cccccc' stroke-width='2'/><path d='M12 7v5l3.5 2' stroke='%23cccccc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 6px center;
}

.sf-time-input:hover {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none'><circle cx='12' cy='12' r='9' stroke='%23e0e0e0' stroke-width='2'/><path d='M12 7v5l3.5 2' stroke='%23e0e0e0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>");
}

.sf-time-input--native {
  color-scheme: dark;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  min-width: 0;
  padding-right: 22px;
  background-size: 12px 12px;
  background-position: right 5px center;
}

.sf-time-input--native::-webkit-calendar-picker-indicator {
  display: none;
  -webkit-appearance: none;
}
</style>
