<script setup lang="ts">
import { computed } from 'vue';
import Panel from './Panel.vue';

const props = defineProps<{
  activeTag: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  'collapse': [];
}>();

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
    @collapse="emit('collapse')"
  />
</template>
