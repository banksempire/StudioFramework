<script setup lang="ts">
import Panel from './Panel.vue';
import type { PanelDef } from '../types/layout';

defineProps<{
  def: PanelDef;
  visible: boolean;
}>();

const emit = defineEmits<{
  collapse: [];
}>();
</script>

<template>
  <Panel
    :title="def.title"
    :visible="visible"
    position="right"
    :sections="def.sections"
    @collapse="emit('collapse')"
  />
</template>
