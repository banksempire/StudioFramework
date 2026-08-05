<script setup lang="ts">
import Panel from './Panel.vue';
import type { PanelAction } from '../types/panel';
import type { PanelDef } from '../types/layout';

defineProps<{
  def: PanelDef;
  visible: boolean;
}>();

const emit = defineEmits<{
  collapse: [];
  resize: [width: number];
  utility: [subId: string, utilityId: string];
  'component-action': [action: PanelAction];
}>();
</script>

<template>
  <Panel
    :title="def.title"
    :visible="visible"
    position="right"
    :sections="def.sections"
    @collapse="emit('collapse')"
    @resize="emit('resize', $event)"
    @utility="(s, u) => emit('utility', s, u)"
    @component-action="(a) => emit('component-action', a)"
  />
</template>
