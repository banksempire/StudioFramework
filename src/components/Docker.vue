<script setup lang="ts">

const props = defineProps<{
  activeTag: string;
  visible?: boolean;
  panelVisible?: boolean;
}>();

const emit = defineEmits<{
  'tag-selected': [tagId: string];
  'tag-double-clicked': [tagId: string];
}>();

interface DockerTag {
  id: string;
  icon: string;
  label: string;
  badge?: number;
}

const tags: DockerTag[] = [
  { id: 'explorer', icon: '📁', label: 'Explorer' },
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'source-control', icon: '📄', label: 'Source Control', badge: 3 },
  { id: 'debug', icon: '🐛', label: 'Debug' },
  { id: 'extensions', icon: '🧩', label: 'Extensions' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];
</script>

<template>
  <div
    class="sf-docker"
    :style="{ display: visible !== undefined && !visible ? 'none' : '' }"
  >
    <div class="sf-docker-handle" />
    <div
      v-for="tag in tags"
      :key="tag.id"
      class="sf-docker-tag"
      :class="{ active: props.activeTag === tag.id && props.panelVisible !== false }"
      :title="tag.label"
      @click="emit('tag-selected', tag.id)"
      @dblclick="emit('tag-double-clicked', tag.id)"
    >
      <span class="sf-docker-tag-icon">{{ tag.icon }}</span>
      <span v-if="tag.badge" class="sf-docker-tag-badge">{{ tag.badge }}</span>
    </div>
  </div>
</template>
