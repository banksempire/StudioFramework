<script setup lang="ts">
import { ref } from 'vue';
import Dialog from './Dialog.vue';
import PillSelector from './PillSelector.vue';

const open = ref(false);
const name = ref('panel-1');
const scope = ref('workspace');
const lastResult = ref('');

const scopeOptions = [
  { value: 'file', label: 'File', title: 'Current file only' },
  { value: 'folder', label: 'Folder', title: 'Current folder' },
  { value: 'workspace', label: 'Workspace', title: 'Whole workspace' },
];

function save() {
  lastResult.value = `saved ${name.value.trim() || '—'} · ${scope.value}`;
  open.value = false;
}
</script>

<template>
  <div class="sf-dialog-demo">
    <button class="sf-dialog-demo-open" type="button" @click="open = true">Open element popup</button>
    <div class="sf-dialog-demo-status">{{ lastResult || 'popup not opened yet' }}</div>
    <Dialog v-model:open="open" title="Edit element">
      <div class="sf-dialog-demo-field">
        <label class="sf-dialog-demo-label" for="sf-dialog-demo-name">Name</label>
        <input id="sf-dialog-demo-name" v-model="name" class="sf-dialog-demo-input" />
      </div>
      <div class="sf-dialog-demo-field">
        <span class="sf-dialog-demo-label">Scope</span>
        <PillSelector v-model="scope" :options="scopeOptions" />
      </div>
      <template #actions="{ close }">
        <button class="sf-dialog-btn" type="button" @click="close()">Cancel</button>
        <button class="sf-dialog-btn sf-dialog-btn--accent" type="button" @click="save">Save</button>
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

.sf-dialog-demo-input {
  width: 100%;
  box-sizing: border-box;
  padding: 5px 7px;
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  background: var(--sf-bg);
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 14px;
  outline: none;
}

.sf-dialog-demo-input:focus {
  border-color: var(--sf-accent);
}
</style>
