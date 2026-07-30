<script setup lang="ts">
import { computed } from 'vue';
import Panel from './Panel.vue';
import type { PanelSection } from './Panel.vue';

const props = defineProps<{
  activeTag: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  'collapse': [];
}>();

interface PanelDef {
  title: string;
  sections: PanelSection[];
}

const panels: Record<string, PanelDef> = {
  explorer: {
    title: 'Files',
    sections: [
      { id: 'files', label: 'Files' },
      { id: 'outline', label: 'Outline' },
      { id: 'timeline', label: 'Timeline' },
      { id: 'npm', label: 'NPM Scripts' },
      { id: 'todo', label: 'TODO' },
    ],
  },
  search: {
    title: 'Search',
    sections: [{ id: 'search', label: 'Search' }],
  },
  'source-control': {
    title: 'Source Control',
    sections: [{ id: 'scm', label: 'SCM' }],
  },
  debug: {
    title: 'Debug',
    sections: [
      { id: 'variables', label: 'Variables' },
      { id: 'watch', label: 'Watch' },
      { id: 'callstack', label: 'Call Stack' },
    ],
  },
  extensions: {
    title: 'Extensions',
    sections: [{ id: 'extensions', label: 'Extensions' }],
  },
  settings: {
    title: 'Settings',
    sections: [
      { id: 'editor', label: 'Editor' },
      { id: 'workspace', label: 'Workspace' },
    ],
  },
};

const def = computed(() => panels[props.activeTag] ?? panels.explorer);
const title = computed(() => def.value.title);
const sections = computed(() => def.value.sections);
</script>

<template>
  <Panel
    :title="title"
    :visible="visible"
    position="left"
    :sections="sections"
    @collapse="emit('collapse')"
  />
</template>
