<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PopupDocument, PopupField, PopupOption, PopupValues } from '../types/popup';
import ColorWheel from './ColorWheel.vue';
import MultiSelectGroup from './MultiSelectGroup.vue';
import PillSelector from './PillSelector.vue';
import PopupDialog from './PopupDialog.vue';
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

const COLOR_CUSTOM = '__custom__';

const COLOR_PRESETS = [
  { hex: '#000000', label: 'Black' },
  { hex: '#8a919c', label: 'Grey' },
  { hex: '#e8e8e8', label: 'White' },
  { hex: '#ef5350', label: 'Red' },
  { hex: '#e7c548', label: 'Amber' },
  { hex: '#26a69a', label: 'Green' },
  { hex: '#5b9dd8', label: 'Blue' },
  { hex: '#c678dd', label: 'Violet' },
];

const colorValue = computed(() => {
  const v = props.values[props.field.key];
  return typeof v === 'string' && v ? v : '';
});

const colorLabel = computed(() => {
  const v = colorValue.value;
  if (!v) return '';
  const preset = COLOR_PRESETS.find((p) => p.hex.toLowerCase() === v.slice(0, 7).toLowerCase());
  if (preset) return `${preset.label} (${preset.hex.toUpperCase()})`;
  return `Custom (${v.toUpperCase()})`;
});

const colorField = computed<PopupField>(() => ({
  ...props.field,
  type: 'select',
  options: [
    ...COLOR_PRESETS.map((p) => ({
      value: p.hex,
      label: `${p.label} (${p.hex.toUpperCase()})`,
      swatch: p.hex,
    })),
    { value: COLOR_CUSTOM, label: 'Custom…' },
  ],
  triggerLabel: colorLabel.value,
  triggerSwatch: colorValue.value || undefined,
}));

const wheelOpen = ref(false);
const wheelValues = ref<PopupValues>({ color: '' });

const wheelDoc: PopupDocument = {
  title: 'Pick a color',
  h2: [{ fields: [{ key: 'color', type: 'colorWheel', span: 2 }] }],
  actions: [
    { id: 'clear', label: 'Default', align: 'left' },
    { id: 'cancel', label: 'Cancel', close: true },
    { id: 'apply', label: 'Apply', tone: 'accent' },
  ],
};

function onColorPatch(_key: string, value: string | number | boolean) {
  if (value === COLOR_CUSTOM) {
    wheelValues.value = { color: colorValue.value };
    wheelOpen.value = true;
    return;
  }
  emit('patch', props.field.key, value);
}

function onWheelValues(v: PopupValues) {
  wheelValues.value = v;
}

function onWheelAction(id: string) {
  if (id === 'clear') wheelValues.value = { color: '' };
  else if (id === 'apply') {
    wheelOpen.value = false;
    emit('patch', props.field.key, String(wheelValues.value.color ?? ''));
  }
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
  <SelectInput
    v-else-if="field.type === 'color'"
    :field="colorField"
    :values="values"
    :input-id="inputId"
    :busy="busy"
    @patch="onColorPatch"
  />
  <div v-else-if="field.type === 'colorWheel'" class="sf-color-wheel-field" :data-color-field="field.key">
    <ColorWheel :color="(values[field.key] as string) ?? ''" @update="(v) => emit('patch', field.key, v)" />
  </div>
  <PopupDialog
    v-if="wheelOpen"
    v-model:open="wheelOpen"
    :doc="wheelDoc"
    :values="wheelValues"
    submit-label="Apply"
    @update:values="onWheelValues"
    @action="onWheelAction"
  />
</template>
