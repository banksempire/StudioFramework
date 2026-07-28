<script setup lang="ts">
import { reactive } from 'vue';

defineProps<{
  visible: boolean;
}>();

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
    class="sf-property-window"
    :style="{ width: visible ? '260px' : '0', display: visible ? '' : 'none' }"
  >
    <div class="sf-property-window-header">Properties</div>

    <div class="sf-property-sections">
      <div v-for="section in sections" :key="section.title" class="sf-property-section">
        <div class="sf-property-section-title">{{ section.title }}</div>

        <div v-for="field in section.fields" :key="field.label" class="sf-property-field">
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