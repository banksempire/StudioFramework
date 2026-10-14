<script setup lang="ts">
import { computed } from 'vue';
import type { PopupField, PopupH2, PopupValues } from '../types/popup';
import FormFieldControl from './FormFieldControl.vue';

const props = defineProps<{
  h2: PopupH2;
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
  const cap = Math.min(Math.max(props.h2.columns ?? 1, 1), 4);
  const rows: PopupField[][] = [];
  let cur: PopupField[] = [];
  let sum = 0;
  for (const field of props.h2.fields) {
    const w = fieldWeight(field);
    if (sum >= cap && cur.length > 0) {
      rows.push(cur);
      cur = [];
      sum = 0;
    }
    cur.push(field);
    sum += w;
  }
  if (cur.length > 0) rows.push(cur);
  return rows;
});

function fieldFlex(field: PopupField): string {
  return `flex: ${fieldWeight(field)} 1 0`;
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
    <div v-for="(row, ri) in fieldRows" :key="ri" class="sf-form-row">
      <template v-for="field in row" :key="field.key">
        <div
          v-if="field.type === 'info'"
          class="sf-form-info"
          :class="[field.class, {
            'sf-form-info--warn': field.hintTone === 'warn',
            'sf-form-info--error': field.hintTone === 'error',
          }]"
          :style="fieldFlex(field)"
        >{{ field.text }}</div>
        <button
          v-else-if="field.type === 'button'"
          type="button"
          class="sf-dialog-btn"
          :class="field.variant && field.variant !== 'default' ? `sf-dialog-btn--${field.variant}` : undefined"
          :style="fieldFlex(field)"
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
          :style="fieldFlex(field)"
        >
          <label
            v-if="field.label"
            class="sf-form-label"
            :for="field.type === 'select' || field.type === 'color' ? undefined : fieldId(field)"
          >
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
  </div>
  <slot v-if="h2.extraSlot" :name="h2.extraSlot" />
</template>
