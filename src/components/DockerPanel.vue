<script setup lang="ts">
import Panel from './Panel.vue';
import type { PanelDef } from '../types/layout';

defineProps<{
  def: PanelDef;
  visible: boolean;
}>();

const emit = defineEmits<{
  collapse: [];
  resize: [width: number];
}>();
</script>

<template>
  <Panel
    :title="def.title"
    :visible="visible"
    position="left"
    :sections="def.sections"
    @collapse="emit('collapse')"
    @resize="emit('resize', $event)"
  />
</template>
