<script setup lang="ts">
import Icon from './Icon.vue';
import type { DockerAppDef } from '../types/layout';

defineProps<{
  items: DockerAppDef[];
  activeApp: string;
  panelVisible?: boolean;
}>();

const emit = defineEmits<{
  'app-selected': [appId: string];
}>();
</script>

<template>
  <div
    class="sf-docker"
  >
    <div class="sf-docker-handle" />
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
