<script setup lang="ts">
import type { PopupField, PopupOption, PopupValues } from '../types/popup';
import MultiSelectGroup from './MultiSelectGroup.vue';
import PillSelector from './PillSelector.vue';
import SelectInput from './SelectInput.vue';
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

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
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
  <SelectInput
    v-else-if="field.type === 'select'"
    :field="field"
    :values="values"
    :input-id="inputId"
    :busy="busy"
    @patch="(key, value) => emit('patch', key, value)"
  />
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
    :id="inputId"
    :on="switchOn()"
    :title="field.labelNote"
    @toggle="emit('patch', field.key, !switchOn())"
  />
  <StepperInput
    v-else-if="field.type === 'stepper'"
    :id="inputId"
    :model-value="stepperValue()"
    :min="field.min ?? 1"
    :max="field.max ?? 100"
    :step="field.step ?? 1"
    :title="field.labelNote"
    @update:model-value="(v) => emit('patch', field.key, v)"
  />
</template>
