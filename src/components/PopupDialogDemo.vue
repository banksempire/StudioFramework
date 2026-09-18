<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PopupDocument, PopupValues } from '../types/popup';
import PopupDialog from './PopupDialog.vue';

const open = ref(false);
const confirmOpen = ref(false);
const busy = ref(false);
const error = ref('');
const lastResult = ref('');

const values = ref<PopupValues>({
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

const doc = computed(
  (): PopupDocument => ({
    title: 'Edit element',
    groups: [
      {
        id: 'connection',
        title: 'Connection',
        sections: [
          {
            title: 'Element',
            columns: 2,
            fields: [
              { key: 'name', type: 'input', label: 'Name', placeholder: 'panel-1', required: true, span: 2 },
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
                hint: values.value.kind === 'fanout' ? 'fanout multiplies copies downstream' : undefined,
              },
              { key: 'tag', type: 'input', label: 'Tag', span: 2, mono: true, placeholder: 'optional' },
              {
                key: 'notes',
                type: 'textarea',
                label: 'Notes',
                span: 2,
                rows: 3,
                hint: Number(values.value.copies ?? 0) > 5 ? 'large copy counts take a while' : undefined,
                hintTone: 'warn',
              },
            ],
          },
        ],
      },
      {
        id: 'delivery',
        title: 'Delivery',
        sections: [
          {
            title: 'Delivery',
            columns: 3,
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
                key: 'region',
                type: 'select',
                label: 'Region',
                options: [
                  { value: 'eu', label: 'EU' },
                  { value: 'us', label: 'US' },
                  { value: 'apac', label: 'APAC' },
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
      },
    ],
    actions: [
      { id: 'cancel', label: 'Cancel', close: true },
      { id: 'save', label: 'Save Element', tone: 'accent' },
    ],
  }),
);

const confirmDoc = computed(
  (): PopupDocument => ({
    title: 'Confirm delete?',
    sections: [
      {
        fields: [{ key: 'warn', type: 'info', text: 'This removes the element and its history.' }],
      },
    ],
    actions: [
      { id: 'cancel', label: 'Cancel', close: true },
      { id: 'delete', label: 'Delete', tone: 'danger', close: true },
    ],
  }),
);

const formRef = ref<{ validate: () => string | null } | null>(null);

async function onAction(id: string) {
  if (id === 'cancel') lastResult.value = 'cancelled';
  if (id === 'save') {
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
  if (id === 'delete') lastResult.value = 'deleted';
}
</script>

<template>
  <div class="sf-formdemo">
    <div class="sf-formdemo-row">
      <button class="sf-formdemo-open" type="button" @click="open = true; error = ''">Open form popup</button>
      <button class="sf-formdemo-confirm" type="button" @click="confirmOpen = true">Open confirm popup</button>
    </div>
    <div class="sf-formdemo-status">{{ lastResult || 'popups not opened yet' }}</div>
    <PopupDialog
      ref="formRef"
      v-model:open="open"
      v-model:values="values"
      :doc="doc"
      wide
      :busy="busy"
      :error="error"
      @action="onAction"
    >
      <template #field-secret>
        <input class="sf-form-input sf-form-input--mono" type="password" value="hunter2" autocomplete="off" />
      </template>
    </PopupDialog>
    <PopupDialog v-model:open="confirmOpen" :doc="confirmDoc" @action="onAction" />
  </div>
</template>

<style scoped>
.sf-formdemo {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-formdemo-row {
  display: flex;
  gap: 8px;
}

.sf-formdemo-open,
.sf-formdemo-confirm {
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
