<script setup lang="ts">
import { computed, ref } from 'vue';

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

const draft = ref<string | null>(null);

const display = computed(() => draft.value ?? (props.modelValue || ''));

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
</script>

<template>
  <input
    :id="id"
    class="sf-form-input sf-time-input"
    type="text"
    inputmode="numeric"
    :value="display"
    :disabled="disabled"
    :title="title"
    placeholder="hh:mm"
    spellcheck="false"
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
}
</style>
