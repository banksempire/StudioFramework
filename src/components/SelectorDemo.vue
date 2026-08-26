<script setup lang="ts">
import { ref } from 'vue';
import MultiSelectGroup from './MultiSelectGroup.vue';
import PillSelector from './PillSelector.vue';

const scope = ref('workspace');
const scopeOptions = [
  { value: 'file', label: 'File', title: 'Current file only' },
  { value: 'folder', label: 'Folder', title: 'Current folder' },
  { value: 'workspace', label: 'Workspace', title: 'Whole workspace' },
];

const days = ref<number[]>([1, 2, 3]);
const dayOptions = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, d) => ({
  value: d,
  label: name,
  title: name,
}));
</script>

<template>
  <div class="sf-selector-demo">
    <div class="sf-selector-demo-row">
      <span class="sf-selector-demo-label">Scope</span>
      <PillSelector v-model="scope" :options="scopeOptions" />
    </div>
    <div class="sf-selector-demo-row">
      <span class="sf-selector-demo-label">Days</span>
      <MultiSelectGroup v-model="days" :options="dayOptions" />
    </div>
    <div class="sf-selector-demo-state">
      scope={{ scope }} · days=[{{ days.join(',') }}]
    </div>
  </div>
</template>

<style scoped>
.sf-selector-demo {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 10px;
  font-size: 13px;
}
.sf-selector-demo-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.sf-selector-demo-label {
  opacity: 0.7;
}
.sf-selector-demo-state {
  opacity: 0.6;
  font-family: var(--sf-font-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
