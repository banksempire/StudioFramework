<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { FormField, FormSchema, FormValues } from '../types/form';
import Dialog from './Dialog.vue';
import FormFieldControl from './FormFieldControl.vue';

const props = withDefaults(
  defineProps<{
    schema: FormSchema;
    values: FormValues;
    title: string;
    open: boolean;
    wide?: boolean;
    busy?: boolean;
    error?: string;
    footNote?: string;
    submitLabel?: string;
    cancelLabel?: string;
    disableClose?: boolean;
  }>(),
  {
    wide: false,
    busy: false,
    error: '',
    footNote: '',
    submitLabel: 'Save',
    cancelLabel: 'Cancel',
    disableClose: false,
  },
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'update:values', value: FormValues): void;
  (e: 'submit'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

const slots = useSlots();
const uid = `sf-form-${Math.random().toString(36).slice(2, 8)}`;

function fieldSlot(field: FormField) {
  return slots[`field-${field.key}`] ?? (field.type === 'slot' ? slots[`field-${field.key}`] : null);
}

function rows(fields: FormField[]): FormField[][] {
  const out: FormField[][] = [];
  let halfRun: FormField[] = [];
  for (const field of fields) {
    if (fieldSlot(field) === null && field.type !== 'slot' && field.half) {
      halfRun.push(field);
      if (halfRun.length === 2) {
        out.push(halfRun);
        halfRun = [];
      }
      continue;
    }
    if (halfRun.length > 0) {
      out.push(halfRun);
      halfRun = [];
    }
    out.push([field]);
  }
  if (halfRun.length > 0) out.push(halfRun);
  return out;
}

const layout = computed(() => props.schema.sections.map((section) => rows(section.fields)));

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

function validate(): string | null {
  for (const section of props.schema.sections) {
    for (const field of section.fields) {
      if (field.type === 'slot') continue;
      const value = props.values[field.key];
      if (field.required && isEmpty(value)) return `${field.label ?? field.key} is required`;
      if (field.type === 'number' && !isEmpty(value) && !Number.isFinite(Number(value))) {
        return `${field.label ?? field.key} must be a number`;
      }
    }
  }
  return null;
}

function patch(key: string, value: string | number) {
  emit('update:values', { ...props.values, [key]: value });
}

function onCancel() {
  emit('cancel');
}

function onClose() {
  emit('close');
}

defineExpose({ validate });
</script>

<template>
  <Dialog
    :open="open"
    :title="title"
    :wide="wide"
    :close-on-backdrop="!disableClose && !busy"
    :close-on-escape="!disableClose && !busy"
    @update:open="(v) => emit('update:open', v)"
    @close="onCancel(); onClose()"
  >
    <div class="sf-form">
      <slot name="preamble" />
      <section
        v-for="(section, si) in schema.sections"
        :key="section.title ?? si"
        class="sf-form-section"
        :class="{ 'sf-form-section--first': si === 0 }"
      >
        <h3 v-if="section.title" class="sf-form-section-title">
          {{ section.title }}
          <span v-if="section.note" class="sf-form-section-note">{{ section.note }}</span>
        </h3>
        <template v-for="(group, gi) in layout[si]" :key="`g-${gi}`">
          <div v-if="group.length > 1" class="sf-form-cols">
            <div
              v-for="field in group"
              :key="field.key"
              class="sf-form-field"
              :class="field.class"
              :data-field="field.key"
            >
              <label v-if="field.label" class="sf-form-label" :for="`${uid}-${field.key}`">
                {{ field.label }}
                <span v-if="field.labelNote" class="sf-form-label-note">{{ field.labelNote }}</span>
              </label>
              <slot :name="`field-${field.key}`" :field="field" :values="values" :patch="patch">
                <FormFieldControl
                  :field="field"
                  :values="values"
                  :input-id="`${uid}-${field.key}`"
                  :busy="busy"
                  @patch="patch"
                />
              </slot>
              <span
                v-if="field.hint"
                class="sf-form-hint"
                :class="{
                  'sf-form-hint--warn': field.hintTone === 'warn',
                  'sf-form-hint--error': field.hintTone === 'error',
                }"
              >{{ field.hint }}</span>
            </div>
          </div>
          <div v-else class="sf-form-field" :class="group[0].class" :data-field="group[0].key">
            <label v-if="group[0].label" class="sf-form-label" :for="`${uid}-${group[0].key}`">
              {{ group[0].label }}
              <span v-if="group[0].labelNote" class="sf-form-label-note">{{ group[0].labelNote }}</span>
            </label>
            <slot :name="`field-${group[0].key}`" :field="group[0]" :values="values" :patch="patch">
              <FormFieldControl
                :field="group[0]"
                :values="values"
                :input-id="`${uid}-${group[0].key}`"
                :busy="busy"
                @patch="patch"
              />
            </slot>
            <span
              v-if="group[0].hint"
              class="sf-form-hint"
              :class="{
                'sf-form-hint--warn': group[0].hintTone === 'warn',
                'sf-form-hint--error': group[0].hintTone === 'error',
              }"
            >{{ group[0].hint }}</span>
          </div>
        </template>
      </section>
      <p v-if="error" class="sf-form-error">{{ error }}</p>
      <p v-else-if="footNote" class="sf-form-hint sf-form-footnote">{{ footNote }}</p>
    </div>
<template #actions="{ close }">
      <slot name="actions" :close="close" :busy="busy">
        <button class="sf-dialog-btn" type="button" :disabled="busy" @click="onCancel(); close()">Cancel</button>
        <button class="sf-dialog-btn sf-dialog-btn--accent" type="button" :disabled="busy" @click="$emit('submit')">
          {{ submitLabel }}
        </button>
      </slot>
    </template>
  </Dialog>
</template>
