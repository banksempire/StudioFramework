<script setup lang="ts">
import type { PopupField, PopupOption, PopupValues } from '../types/popup';
import MultiSelectGroup from './MultiSelectGroup.vue';
import PillSelector from './PillSelector.vue';
import StepperInput from './StepperInput.vue';
import SwitchToggle from './SwitchToggle.vue';

const props = defineProps<{
  field: PopupField;
  values: PopupValues;
  inputId: string;
  busy?: boolean;
}>();

const emit =
  defineEmits<(e: 'patch', key: string, value: string | number | boolean | Array<string | number>) => void>();

const INPUT_TYPES = ['input', 'number', 'password', 'datetime-local'];

function isGrouped(
  choices: PopupField['options'],
): choices is NonNullable<PopupField['options']> & Array<{ group: string; options: PopupOption[] }> {
  return Array.isArray(choices) && choices.length > 0 && 'group' in choices[0];
}

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

function onMulti(value: Array<string | number>) {
  emit('patch', props.field.key, value);
}

function switchOn(): boolean {
  const v = props.values[props.field.key];
  return v === true || v === 'true';
}

function stepperValue(): number {
  const v = props.values[props.field.key];
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : (props.field.min ?? 1);
}

function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || String(value).trim() === '';
}
</script>

<template>
  <input
    v-if="INPUT_TYPES.includes(field.type)"
    :id="inputId"
    :value="(values[field.key] as string | number) ?? ''"
    :type="field.type"
    class="sf-form-input"
    :class="[field.inputClass, { 'sf-form-input--mono': field.mono }]"
    :placeholder="field.placeholder"
    :disabled="field.disabled || busy"
    :spellcheck="field.spellcheck ?? false"
    @input="onInput"
  />
  <textarea
    v-else-if="field.type === 'textarea'"
    :id="inputId"
    :value="(values[field.key] as string) ?? ''"
    class="sf-form-input sf-form-textarea"
    :class="field.inputClass"
    :rows="field.rows ?? 3"
    :placeholder="field.placeholder"
    :disabled="field.disabled || busy"
    :spellcheck="field.spellcheck ?? false"
    @input="onInput"
  />
  <select
    v-else-if="field.type === 'select'"
    :id="inputId"
    :value="(values[field.key] as string | number) ?? ''"
    class="sf-form-input sf-form-select"
    :class="field.inputClass"
    :disabled="field.disabled || busy"
    @change="onSelect"
  >
    <option v-if="field.blankLabel && isEmpty(values[field.key])" value="" disabled hidden>
      {{ field.blankLabel }}
    </option>
    <template v-if="isGrouped(field.options)">
      <optgroup v-for="g in field.options" :key="g.group" :label="g.group">
        <option v-for="opt in g.options" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
      </optgroup>
    </template>
    <template v-else>
      <option
        v-for="opt in ((field.options as PopupOption[]) ?? [])"
        :key="String(opt.value)"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
    </template>
  </select>
  <PillSelector
    v-else-if="field.type === 'pills'"
    :options="((field.options as PopupOption[]) ?? [])"
    :model-value="(values[field.key] as string | number) ?? ''"
    @update:model-value="onPills"
  />
  <MultiSelectGroup
    v-else-if="field.type === 'multi'"
    :options="((field.options as PopupOption[]) ?? [])"
    :model-value="(values[field.key] as Array<string | number>) ?? []"
    @update:model-value="onMulti"
  />
  <SwitchToggle
    v-else-if="field.type === 'switch'"
    :on="switchOn()"
    :title="field.labelNote"
    @toggle="emit('patch', field.key, !switchOn())"
  />
  <StepperInput
    v-else-if="field.type === 'stepper'"
    :model-value="stepperValue()"
    :min="field.min ?? 1"
    :max="field.max ?? 100"
    :step="field.step ?? 1"
    :title="field.labelNote"
    @update:model-value="(v) => emit('patch', field.key, v)"
  />
</template>
