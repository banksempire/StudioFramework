<script setup lang="ts">
import type { DockerAppDef } from '../types/layout';
import Icon from './Icon.vue';

withDefaults(
  defineProps<{
    items: DockerAppDef[];
    activeApp: string;
    panelVisible?: boolean;
    /** 'left' = the desktop icon rail; 'bottom' = the mobile dock. */
    position?: 'left' | 'bottom';
  }>(),
  {
    panelVisible: true,
    position: 'left',
  },
);

const emit = defineEmits<{
  'app-selected': [appId: string];
}>();
</script>

<template>
  <div
    class="sf-docker"
    :class="{ 'sf-docker--bottom': position === 'bottom' }"
  >
    <div v-if="position === 'left'" class="sf-docker-handle" />
    <div
      v-for="app in items"
      :key="app.id"
      class="sf-docker-app"
      :class="{ active: activeApp === app.id && panelVisible !== false }"
      :title="app.displayName"
      @click="emit('app-selected', app.id)"
    >
      <Icon class="sf-docker-app-icon" :icon="app.icon" />
      <span v-if="app.badge" class="sf-docker-app-badge">{{ app.badge }}</span>
    </div>
  </div>
</template>
