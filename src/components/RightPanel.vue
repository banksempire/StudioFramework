<script setup lang="ts">
import { reactive } from 'vue';
import { useResize } from '../composables/useResize.js';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'collapse': [];
}>();

const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: 180,
  max: 500,
  direction: 'left',
  onCollapse: () => emit('collapse'),
});

interface FieldDef {
  label: string;
  model: string | number | boolean;
  type: 'text' | 'number' | 'checkbox' | 'select';
  options?: string[];
}

interface Section {
  title: string;
  fields: FieldDef[];
}

const sections: Section[] = reactive([
  {
    title: 'Font',
    fields: [
      { label: 'Family', model: 'Consolas', type: 'select', options: ['Consolas', 'Fira Code', 'JetBrains Mono', 'Monaco'] },
      { label: 'Size', model: 14, type: 'number' },
      { label: 'Ligatures', model: true, type: 'checkbox' },
    ],
  },
  {
    title: 'Language',
    fields: [
      { label: 'Mode', model: 'TypeScript', type: 'select', options: ['TypeScript', 'JavaScript', 'CSS', 'HTML', 'JSON'] },
      { label: 'Tab Size', model: 2, type: 'number' },
    ],
  },
  {
    title: 'Workspace',
    fields: [
      { label: 'Auto Save', model: false, type: 'checkbox' },
      { label: 'Word Wrap', model: true, type: 'checkbox' },
    ],
  },
]);
</script>

<template>
  <div
    class="sf-right-panel"
    :class="{
      'sf-right-panel--dragging': dragging,
      'sf-right-panel--will-collapse': willCollapse,
    }"
    :style="visible ? { width: width + 'px' } : { width: '0', display: 'none' }"
  >
    <div
      class="sf-panel-resize-handle sf-panel-resize-handle--left"
      @mousedown="onMouseDown"
    />

    <div class="sf-right-panel-header">Properties</div>

    <div class="sf-right-panel-sections">
      <div v-for="section in sections" :key="section.title" class="sf-right-panel-section">
        <div class="sf-right-panel-section-title">{{ section.title }}</div>

        <div v-for="field in section.fields" :key="field.label" class="sf-right-panel-field">
          <label>{{ field.label }}</label>

          <select
            v-if="field.type === 'select' && field.options"
            v-model="field.model"
          >
            <option v-for="opt in field.options" :key="opt" :value="opt">
              {{ opt }}
            </option>
          </select>

          <input
            v-else-if="field.type === 'checkbox'"
            v-model="field.model"
            type="checkbox"
          />

          <input
            v-else
            v-model="field.model"
            :type="field.type"
          />
        </div>
      </div>
    </div>
  </div>
</template>
