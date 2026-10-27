<script setup lang="ts">
import { computed } from 'vue';
import type { PopupField, PopupFieldGroup, PopupValues } from '../types/popup';
import FormFieldControl from './FormFieldControl.vue';

const props = defineProps<{
  h2: PopupFieldGroup;
  values: PopupValues;
  uid: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  patch: [key: string, value: string | number | boolean | Array<string | number>];
  action: [id: string, key: string];
}>();

function fieldWeight(field: PopupField): number {
  return Math.max(1, Math.round(field.span ?? 1));
}

const fieldRows = computed<PopupField[][]>(() => {
  const rows: PopupField[][] = [];
  for (const field of props.h2.fields) {
    const line = field.line;
    const last = rows[rows.length - 1];
    if (line !== undefined && last !== undefined && last[0]?.line === line) last.push(field);
    else rows.push([field]);
  }
  return rows;
});

function fieldSpan(field: PopupField, index: number): string {
  return `--sf-span: ${fieldWeight(field)}; grid-column: ${index + 1}`;
}

function rowColumns(row: PopupField[]): string {
  return row.map((field) => `minmax(auto, ${fieldWeight(field)}fr)`).join(' ');
}

function fieldId(field: PopupField): string {
  return field.id ?? `${props.uid}-${field.key}`;
}

function patch(key: string, value: string | number | boolean | Array<string | number>) {
  emit('patch', key, value);
}
</script>

<template>
  <p v-if="h2.note" class="sf-form-section-note">{{ h2.note }}</p>
  <div class="sf-form-grid">
    <div v-for="(row, ri) in fieldRows" :key="ri" class="sf-form-row" :style="{ gridTemplateColumns: rowColumns(row) }">
      <template v-for="(field, fi) in row" :key="field.key">
        <div
          v-if="field.type === 'info'"
          :data-field="field.key"
          class="sf-form-info"
          :class="[field.class, {
            'sf-form-info--warn': field.hintTone === 'warn',
            'sf-form-info--error': field.hintTone === 'error',
          }]"
          :style="fieldSpan(field, fi)"
        >{{ field.text }}</div>
        <button
          v-else-if="field.type === 'button'"
          type="button"
          class="sf-dialog-btn"
          :class="field.variant && field.variant !== 'default' ? `sf-dialog-btn--${field.variant}` : undefined"
          :style="fieldSpan(field, fi)"
          :disabled="field.disabled || busy"
          :title="field.labelNote"
          @click="emit('action', field.action ?? field.key, field.key)"
        >
          {{ field.label ?? field.key }}
        </button>
        <div
          v-else
          class="sf-form-field"
          :class="field.class"
          :data-field="field.key"
          :style="fieldSpan(field, fi)"
        >
          <label
            v-if="field.label"
            class="sf-form-label"
            :for="field.type === 'select' || field.type === 'color' ? undefined : fieldId(field)"
          >
            {{ field.label }}
            <span v-if="field.labelNote" class="sf-form-label-note">{{ field.labelNote }}</span>
          </label>
          <FormFieldControl
            :field="field"
            :values="values"
            :input-id="fieldId(field)"
            :busy="busy"
            @patch="patch"
          />
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
  </div>
</template>
