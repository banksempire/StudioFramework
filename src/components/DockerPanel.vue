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

// Each Docker panel has its own sections — they are sub-contexts WITHIN a panel.
// Only panels with multiple sections show the tab bar.

const sectionsMap: Record<string, PanelSection[]> = {
  explorer: [
    { id: 'files', label: 'Files' },
    { id: 'outline', label: 'Outline' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'npm', label: 'NPM Scripts' },
    { id: 'todo', label: 'TODO' },
  ],
  search: [
    { id: 'search', label: 'Search' },
  ],
  'source-control': [
    { id: 'scm', label: 'SCM' },
  ],
  debug: [
    { id: 'variables', label: 'Variables' },
    { id: 'watch', label: 'Watch' },
    { id: 'callstack', label: 'Call Stack' },
  ],
  extensions: [
    { id: 'extensions', label: 'Extensions' },
  ],
  settings: [
    { id: 'editor', label: 'Editor' },
    { id: 'workspace', label: 'Workspace' },
  ],
};

const sections = computed(() => sectionsMap[props.activeTag] ?? []);

const title = computed(() => {
  const map: Record<string, string> = {
    explorer: 'Files',
    search: 'Search',
    'source-control': 'Source Control',
    extensions: 'Extensions',
    settings: 'Settings',
    debug: 'Debug',
  };
  return map[props.activeTag] || 'Explorer';
});
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
