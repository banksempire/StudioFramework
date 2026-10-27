<script setup lang="ts">
import { ref } from 'vue';
import type { PopupDocument, PopupField, PopupValues } from '../types/popup';
import Dialog from './Dialog.vue';
import FormFields from './FormFields.vue';
import PillSelector from './PillSelector.vue';
import PopupDialog from './PopupDialog.vue';

const open = ref(false);
const wideOpen = ref(false);
const panelOpen = ref(false);
const panelValues = ref<PopupValues>({ pname: '', pslot: '', ptier2: 'a', pmode: 'fast', pstep: 10 });

const panelDoc: PopupDocument = {
  title: 'Panel popup',
  h1: [
    {
      id: 'general',
      title: 'General',
      h2: [
        {
          title: 'Identity',
          fields: [
            { key: 'pname', type: 'input', label: 'Name' },
            { key: 'pslot', type: 'slot', label: 'Slot' },
          ],
        },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced',
      h2: [
        {
          title: 'Options',
          fields: [
            {
              key: 'ptier2',
              type: 'select',
              label: 'Tier',
              options: [
                { value: 'a', label: 'Alpha' },
                { value: 'b', label: 'Beta' },
              ],
            },
            {
              key: 'pmode',
              type: 'pills',
              label: 'Mode',
              options: [
                { value: 'fast', label: 'Fast' },
                { value: 'slow', label: 'Slow' },
              ],
            },
            {
              key: 'pstep',
              type: 'stepper',
              label: 'Cap',
              min: 1,
              max: 1000000,
              step: 10,
              shorthand: true,
            },
            { key: 'pping', type: 'button', label: 'Ping', action: 'ping-demo' },
          ],
        },
      ],
    },
  ],
  actions: [
    { id: 'cancel', label: 'Cancel', close: true },
    { id: 'psave', label: 'Save', tone: 'accent', close: true },
  ],
};

function onPanelAction(id: string) {
  if (id === 'psave') {
    lastResult.value = `panel saved ${panelValues.value.pname ?? ''}/${panelValues.value.pslot ?? ''}/${panelValues.value.ptier2 ?? ''}`;
  } else if (id === 'ping-demo') {
    lastResult.value = 'pinged';
  }
}
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
    key: 'accent',
    type: 'color',
    label: 'Accent color',
    line: 'pair',
  },
  {
    key: 'tier',
    type: 'select',
    label: 'Tier',
    line: 'pair',
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
  {
    key: 'tint',
    type: 'color',
    label: 'Tint',
    emptyLabel: 'Default (#544FED)',
    emptySwatch: '#544fed',
  },
  {
    key: 'alias',
    type: 'input',
    label: 'Alias',
    line: 'weights',
    placeholder: 'span 1',
  },
  {
    key: 'tag',
    type: 'input',
    label: 'Tag',
    line: 'weights',
    placeholder: 'span 3',
    span: 3,
  },
  {
    key: 'mode',
    type: 'pills',
    label: 'Mode',
    options: [
      { value: 'fast', label: 'Fast' },
      { value: 'slow', label: 'Slow' },
    ],
  },
  {
    key: 'caps2',
    type: 'stepper',
    label: 'Cap',
    min: 1,
    max: 1000000,
    step: 10,
    shorthand: true,
  },
  {
    key: 'note',
    type: 'info',
    text: 'Info and button fields can span the grid.',
  },
  {
    key: 'reset',
    type: 'button',
    label: 'Reset demo',
    action: 'reset-demo',
  },
];

const formValues = ref<Record<string, string>>({ size: 'm', tier: 'b', accent: '#544fed' });

function onFormAction(id: string) {
  if (id === 'reset-demo') {
    formValues.value = { size: 'm', tier: 'b', accent: '#544fed' };
    lastResult.value = 'reset demo values';
  }
}

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
      <button class="sf-dialog-demo-open-panel" type="button" @click="panelOpen = true">Open panel popup</button>
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
      <FormFields :h2="{ fields: formFields }"
        :values="formValues"
        uid="sf-dialog-demo"
        @patch="patchForm"
        @action="onFormAction"
      />
      <template #actions="{ close }">
        <button class="sf-dialog-btn" type="button" @click="close()">Cancel</button>
        <button class="sf-dialog-btn sf-dialog-btn--accent" type="button" @click="save">Save</button>
      </template>
    </Dialog>
    <PopupDialog
      v-model:open="panelOpen"
      :doc="panelDoc"
      :values="panelValues"
      @update:values="(v) => (panelValues = v)"
      @action="onPanelAction"
    >
      <template #field-pslot>
        <input
          v-model="panelValues.pslot"
          class="sf-form-input sf-dialog-demo-slot-input"
          placeholder="slotted control"
        />
      </template>
    </PopupDialog>
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
