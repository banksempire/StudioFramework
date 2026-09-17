<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FormSchema, FormValues } from '../types/form';
import FormDialog from './FormDialog.vue';

const open = ref(false);
const busy = ref(false);
const error = ref('');
const lastResult = ref('');

const values = ref<FormValues>({
  name: 'panel-1',
  kind: '',
  scope: 'workspace',
  copies: 1,
  notes: '',
});

const kindOptions = [
  { value: 'plain', label: 'Plain' },
  { value: 'fanout', label: 'Fanout' },
];

const schema = computed(
  (): FormSchema => ({
    sections: [
      {
        title: 'Element',
        fields: [
          { key: 'name', type: 'text', label: 'Name', placeholder: 'panel-1', required: true },
          {
            key: 'kind',
            type: 'select',
            label: 'Kind',
            options: kindOptions,
            blankLabel: 'select a kind…',
            required: true,
          },
          {
            key: 'copies',
            type: 'number',
            label: 'Copies',
            half: true,
            hint: values.value.kind === 'fanout' ? 'fanout multiplies copies downstream' : undefined,
          },
          { key: 'tag', type: 'text', label: 'Tag', half: true, mono: true, placeholder: 'optional' },
          {
            key: 'notes',
            type: 'textarea',
            label: 'Notes',
            rows: 3,
            hint: Number(values.value.copies ?? 0) > 5 ? 'large copy counts take a while' : undefined,
            hintTone: 'warn',
          },
        ],
      },
      {
        title: 'Delivery',
        fields: [
          {
            key: 'scope',
            type: 'pills',
            label: 'Scope',
            options: [
              { value: 'file', label: 'File', title: 'Current file only' },
              { value: 'folder', label: 'Folder', title: 'Current folder' },
              { value: 'workspace', label: 'Workspace', title: 'Whole workspace' },
            ],
          },
          {
            key: 'secret',
            type: 'slot',
            label: 'Secret',
            hint: 'slot fields keep custom controls inside the themed layout',
          },
        ],
      },
    ],
  }),
);

async function submit() {
  const invalid = formRef.value?.validate();
  if (invalid) {
    error.value = invalid;
    return;
  }
  busy.value = true;
  await new Promise((r) => setTimeout(r, 300));
  busy.value = false;
  lastResult.value = `saved ${String(values.value.name)} · ${String(values.value.kind)} · scope ${String(values.value.scope)}`;
  open.value = false;
}

const formRef = ref<{ validate: () => string | null } | null>(null);
</script>

<template>
  <div class="sf-formdemo">
    <button class="sf-formdemo-open" type="button" @click="open = true; error = ''">Open form popup</button>
    <div class="sf-formdemo-status">{{ lastResult || 'form popup not opened yet' }}</div>
    <FormDialog
      ref="formRef"
      v-model:values="values"
      :schema="schema"
      :open="open"
      title="Edit element (form)"
      wide
      :busy="busy"
      :error="error"
      submit-label="Save Element"
      @submit="submit"
      @cancel="lastResult = 'cancelled'"
    >
      <template #field-secret>
        <input
          class="sf-form-input sf-form-input--mono"
          type="password"
          value="hunter2"
          autocomplete="off"
        />
      </template>
    </FormDialog>
  </div>
</template>

<style scoped>
.sf-formdemo {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-formdemo-open {
  align-self: flex-start;
  padding: 5px 12px;
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  background: var(--sf-bg);
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 13px;
  cursor: pointer;
}

.sf-formdemo-status {
  font-size: 12px;
  color: var(--sf-text-muted);
}
</style>
