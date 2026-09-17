<script setup lang="ts">
import type { FormField, FormValues } from '../types/form';
import PillSelector from './PillSelector.vue';

const props = defineProps<{
  field: FormField;
  values: FormValues;
  inputId: string;
  busy?: boolean;
}>();

const emit = defineEmits<(e: 'patch', key: string, value: string | number) => void>();

const INPUT_TYPES = ['text', 'number', 'password', 'datetime-local'];

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('patch', props.field.key, target.value);
}

function onSelect(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('patch', props.field.key, target.value);
}

function onPills(value: string | number) {
  emit('patch', props.field.key, value);
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}
</script>

<template>
  <input
    v-if="INPUT_TYPES.includes(field.type)"
    :id="inputId"
    :value="values[field.key] ?? ''"
    :type="field.type"
    class="sf-form-input"
    :class="{ 'sf-form-input--mono': field.mono }"
    :placeholder="field.placeholder"
    :disabled="field.disabled || busy"
    :spellcheck="field.spellcheck ?? false"
    @input="onInput"
  />
  <textarea
    v-else-if="field.type === 'textarea'"
    :id="inputId"
    :value="values[field.key] ?? ''"
    class="sf-form-input sf-form-textarea"
    :rows="field.rows ?? 3"
    :placeholder="field.placeholder"
    :disabled="field.disabled || busy"
    :spellcheck="field.spellcheck ?? false"
    @input="onInput"
  />
  <select
    v-else-if="field.type === 'select'"
    :id="inputId"
    :value="values[field.key] ?? ''"
    class="sf-form-input sf-form-select"
    :disabled="field.disabled || busy"
    @change="onSelect"
  >
    <option v-if="field.blankLabel && isEmpty(values[field.key])" value="" disabled hidden>
      {{ field.blankLabel }}
    </option>
    <option v-for="opt in field.options" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
  </select>
  <PillSelector
    v-else-if="field.type === 'pills'"
    :options="field.options ?? []"
    :model-value="(values[field.key] as string | number) ?? ''"
    @update:model-value="onPills"
  />
</template>
