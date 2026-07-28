<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  activeTag: string;
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

const clickTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const lastClicked = ref<string | null>(null);

function onTagClick(tagId: string) {
  if (clickTimer.value && lastClicked.value === tagId) {
    clearTimeout(clickTimer.value);
    clickTimer.value = null;
    lastClicked.value = null;
    emit('tag-double-clicked', tagId);
  } else {
    lastClicked.value = tagId;
    clickTimer.value = setTimeout(() => {
      clickTimer.value = null;
      lastClicked.value = null;
      emit('tag-selected', tagId);
    }, 300);
  }
}
</script>

<template>
  <div class="sf-docker">
    <div class="sf-docker-handle" />
    <div
      v-for="tag in tags"
      :key="tag.id"
      class="sf-docker-tag"
      :class="{ active: props.activeTag === tag.id }"
      :title="tag.label"
      @click="onTagClick(tag.id)"
    >
      <span class="sf-docker-tag-icon">{{ tag.icon }}</span>
      <span v-if="tag.badge" class="sf-docker-tag-badge">{{ tag.badge }}</span>
    </div>
  </div>
</template>