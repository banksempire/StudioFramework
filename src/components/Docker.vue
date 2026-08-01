<script setup lang="ts">
import Icon from './Icon.vue';
import type { DockerItemDef } from '../types/layout';

defineProps<{
  items: DockerItemDef[];
  activeTag: string;
  visible?: boolean;
  panelVisible?: boolean;
}>();

const emit = defineEmits<{
  'tag-selected': [tagId: string];
}>();
</script>

<template>
  <div
    class="sf-docker"
    :style="{ display: visible !== undefined && !visible ? 'none' : '' }"
  >
    <div class="sf-docker-handle" />
    <div
      v-for="tag in items"
      :key="tag.id"
      class="sf-docker-tag"
      :class="{ active: activeTag === tag.id && panelVisible !== false }"
      :title="tag.displayName"
      @click="emit('tag-selected', tag.id)"
    >
      <Icon class="sf-docker-tag-icon" :icon="tag.icon" />
      <span v-if="tag.badge" class="sf-docker-tag-badge">{{ tag.badge }}</span>
    </div>
  </div>
</template>
