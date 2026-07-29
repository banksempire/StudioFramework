<script setup lang="ts">
import type { PanelPayload } from '../types/panel.js';
import Panel from './Panel.vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'collapse': [];
}>();

const payload: PanelPayload = {
  title: 'Properties',
  sections: [
    {
      id: 'font',
      label: 'Font',
      subSections: [
        {
          id: 'font-settings',
          displayName: 'Font Settings',
          components: [
            {
              type: 'dropdown',
              id: 'font-family',
              contents: {
                options: ['Consolas', 'Fira Code', 'JetBrains Mono', 'Monaco'],
                value: 'Consolas',
                label: 'Family',
              },
            },
            { type: 'slider', id: 'font-size', contents: { min: 10, max: 32, value: 14, label: 'Size' } },
            { type: 'checkbox', id: 'ligatures', contents: { checked: true, label: 'Ligatures' } },
          ],
        },
      ],
    },
    {
      id: 'language',
      label: 'Language',
      subSections: [
        {
          id: 'lang-settings',
          displayName: 'Language Settings',
          components: [
            {
              type: 'dropdown',
              id: 'lang-mode',
              contents: {
                options: ['TypeScript', 'JavaScript', 'CSS', 'HTML', 'JSON'],
                value: 'TypeScript',
                label: 'Mode',
              },
            },
            { type: 'dropdown', id: 'tab-size', contents: { options: ['2', '4', '8'], value: '2', label: 'Tab Size' } },
          ],
        },
      ],
    },
    {
      id: 'workspace',
      label: 'Workspace',
      subSections: [
        {
          id: 'ws-settings',
          displayName: 'Workspace Settings',
          components: [
            { type: 'checkbox', id: 'auto-save', contents: { checked: false, label: 'Auto Save' } },
            { type: 'checkbox', id: 'word-wrap', contents: { checked: true, label: 'Word Wrap' } },
          ],
        },
      ],
    },
  ],
};
</script>

<template>
  <Panel
    :payload="payload"
    :visible="visible"
    position="right"
    @collapse="emit('collapse')"
  />
</template>
