<script setup lang="ts">
import Panel from './Panel.vue';
import type { PanelSection } from './Panel.vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'collapse': [];
}>();

const sections: PanelSection[] = [
  { id: 'properties', label: 'Properties' },
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
