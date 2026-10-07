<script setup lang="ts">
import { ref } from 'vue';
import type { PopupField } from '../types/popup';
import Dialog from './Dialog.vue';
import FormFields from './FormFields.vue';
import PillSelector from './PillSelector.vue';

const open = ref(false);
const wideOpen = ref(false);
const name = ref('panel-1');
const scope = ref('workspace');
const lastResult = ref('');

const scopeOptions = [
  { value: 'file', label: 'File', title: 'Current file only' },
  { value: 'folder', label: 'Folder', title: 'Current folder' },
  { value: 'workspace', label: 'Workspace', title: 'Whole workspace' },
];

const formFields: PopupField[] = [
  {
    key: 'size',
    type: 'select',
    label: 'Size',
    options: [
      { value: 's', label: 'Small' },
      { value: 'm', label: 'Medium' },
      { value: 'l', label: 'Large' },
      { value: 'x', label: 'Extra large', disabled: true },
    ],
  },
  {
    key: 'tier',
    type: 'select',
    label: 'Tier',
    options: [
      {
        group: 'Core',
        options: [
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ],
      },
      {
        group: 'Edge',
        options: [{ value: 'g', label: 'Gamma' }],
      },
    ],
  },
];

const formValues = ref<Record<string, string>>({ size: 'm', tier: 'b' });

function patchForm(key: string, value: string | number | boolean | Array<string | number>) {
  formValues.value[key] = String(value);
}

function save() {
  const form = formFields.map((f) => `${f.key}:${formValues.value[f.key] ?? ''}`).join(' ');
  lastResult.value = `saved ${name.value.trim() || '—'} · ${scope.value} · ${form}`;
  open.value = false;
}
</script>

<template>
  <div class="sf-dialog-demo">
    <div class="sf-dialog-demo-row">
      <button class="sf-dialog-demo-open" type="button" @click="open = true">Open element popup</button>
      <button class="sf-dialog-demo-open-wide" type="button" @click="wideOpen = true">Open wide popup</button>
    </div>
    <div class="sf-dialog-demo-status">{{ lastResult || 'popup not opened yet' }}</div>
    <Dialog v-model:open="open" title="Edit element">
      <div class="sf-dialog-demo-field">
        <label class="sf-dialog-demo-label" for="sf-dialog-demo-name">Name</label>
        <input id="sf-dialog-demo-name" v-model="name" class="sf-dialog-input" />
      </div>
      <div class="sf-dialog-demo-field">
        <span class="sf-dialog-demo-label">Scope</span>
        <PillSelector v-model="scope" :options="scopeOptions" />
      </div>
      <FormFields :h2="{ fields: formFields }" :values="formValues" uid="sf-dialog-demo" @patch="patchForm" />
      <template #actions="{ close }">
        <button class="sf-dialog-btn" type="button" @click="close()">Cancel</button>
        <button class="sf-dialog-btn sf-dialog-btn--accent" type="button" @click="save">Save</button>
      </template>
    </Dialog>
    <Dialog v-model:open="wideOpen" wide title="Edit element (wide)">
      <div class="sf-dialog-demo-field">
        <label class="sf-dialog-demo-label" for="sf-dialog-demo-wide-name">Name</label>
        <input id="sf-dialog-demo-wide-name" v-model="name" class="sf-dialog-input" />
      </div>
      <template #actions="{ close }">
        <button class="sf-dialog-btn" type="button" @click="close()">Close</button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.sf-dialog-demo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 6px;
}

.sf-dialog-demo-row {
  display: flex;
  gap: 6px;
}

.sf-dialog-demo-open {
  align-self: flex-start;
  padding: 4px 12px;
  border: none;
  border-radius: var(--sf-radius-sm);
  background: var(--sf-accent);
  color: var(--sf-text-on-accent);
  font-family: var(--sf-font);
  font-size: 13px;
  cursor: pointer;
}

@media (hover: hover) {
  .sf-dialog-demo-open:hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
  }
}

.sf-dialog-demo-status {
  font-family: var(--sf-mono, monospace);
  font-size: 13px;
  color: var(--sf-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sf-dialog-demo-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.sf-dialog-demo-label {
  font-size: 12px;
  color: var(--sf-text-muted);
}

</style>
