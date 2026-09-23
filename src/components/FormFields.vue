<script setup lang="ts">
import type { PopupField, PopupSection, PopupValues } from '../types/popup';
import FormFieldControl from './FormFieldControl.vue';

const props = defineProps<{
  section: PopupSection;
  values: PopupValues;
  uid: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  patch: [key: string, value: string | number | boolean | Array<string | number>];
}>();

function sectionCols(section: PopupSection): number {
  return Math.min(Math.max(section.columns ?? 1, 1), 4);
}

function fieldSpan(field: PopupField): string | undefined {
  const span = Math.min(Math.max(field.span ?? 1, 1), sectionCols(props.section));
  return span > 1 ? `grid-column: span ${span}` : undefined;
}

function fieldId(field: PopupField): string {
  return field.id ?? `${props.uid}-${field.key}`;
}

function patch(key: string, value: string | number | boolean | Array<string | number>) {
  emit('patch', key, value);
}
</script>

<template>
  <p v-if="section.note" class="sf-form-section-note">{{ section.note }}</p>
  <div class="sf-form-grid" :data-cols="sectionCols(section)">
    <template v-for="field in section.fields" :key="field.key">
      <div
        v-if="field.type === 'info'"
        class="sf-form-info"
        :class="[field.class, {
          'sf-form-info--warn': field.hintTone === 'warn',
          'sf-form-info--error': field.hintTone === 'error',
        }]"
      >{{ field.text }}</div>
      <div
        v-else
        class="sf-form-field"
        :class="field.class"
        :data-field="field.key"
        :style="fieldSpan(field)"
      >
        <label v-if="field.label" class="sf-form-label" :for="fieldId(field)">
          {{ field.label }}
          <span v-if="field.labelNote" class="sf-form-label-note">{{ field.labelNote }}</span>
        </label>
        <slot
          :name="`field-${field.key}`"
          :field="field"
          :values="values"
          :patch="patch"
        >
          <FormFieldControl
            :field="field"
            :values="values"
            :input-id="fieldId(field)"
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
    </template>
  </div>
  <slot v-if="section.extraSlot" :name="section.extraSlot" />
</template>
