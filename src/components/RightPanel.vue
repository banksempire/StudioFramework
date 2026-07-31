<script setup lang="ts">
import Panel from './Panel.vue';
import type { PanelSection } from '../types/panel';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  collapse: [];
}>();

const sections: PanelSection[] = [
  {
    id: 'properties', label: 'Properties',
    subSections: [
      {
        id: 'element-props', label: 'Element', isHeightVariable: false,
        components: [
          { type: 'keyValueList', items: [
            { key: 'id', value: 'panel-1' },
            { key: 'class', value: 'sf-panel sf-panel--left' },
            { key: 'width', value: '260px' },
            { key: 'visible', value: 'true' },
          ]},
        ],
      },
      {
        id: 'style-props', label: 'Style', isHeightVariable: false,
        components: [
          { type: 'keyValueList', items: [
            { key: 'background', value: '#252526' },
            { key: 'border-right', value: '1px solid #3c3c3c' },
            { key: 'color', value: '#cccccc' },
          ]},
        ],
      },
      {
        id: 'events-props', label: 'Events', isHeightVariable: true, minHeight: 60,
        utilities: [{ id: 'refresh', icon: '↻', tooltip: 'Refresh' }],
        components: [
          { type: 'list', items: [
            { id: 'ev1', label: 'collapse', icon: '⚡' },
            { id: 'ev2', label: 'select-section', icon: '⚡' },
          ]},
        ],
      },
    ],
  },
];
</script>

<template>
  <Panel
    title="Properties"
    :visible="visible"
    position="right"
    :sections="sections"
    @collapse="emit('collapse')"
  />
</template>
