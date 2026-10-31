<script setup lang="ts">
import { computed } from 'vue';
import { useWorkspaceContext } from '../composables/useWorkspace';
import Workspace from './Workspace.vue';

const props = defineProps<{ windowId: number }>();
const ws = useWorkspaceContext();

const api = computed(() => ws.auxApi(props.windowId));
const targetEl = computed(() => ws.auxWindowContentEl(props.windowId));
const popupMobile = computed(() => ws.auxMobile.get(props.windowId) ?? false);
const def = { tabs: [] };
</script>

<template>
  <Teleport v-if="targetEl" :to="targetEl">
    <Workspace :def="def" :api="api" :mobile="popupMobile" />
  </Teleport>
</template>
