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

let clickCount = 0;
let clickTimer: ReturnType<typeof setTimeout> | null = null;
let lastClickedTag = '';

function onTagClick(tagId: string) {
  if (lastClickedTag !== tagId) {
    // Different tag clicked — reset
    clickCount = 0;
    if (clickTimer) clearTimeout(clickTimer);
    lastClickedTag = tagId;
  }
  clickCount++;

  if (clickCount === 1) {
    emit('tag-selected', tagId);
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 300);
  } else if (clickCount === 2) {
    clearTimeout(clickTimer!);
    clickCount = 0;
    emit('tag-double-clicked', tagId);
  }
}
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
      @click="onTagClick(tag.id)"
    >
      <span class="sf-docker-tag-icon">{{ tag.icon }}</span>
      <span v-if="tag.badge" class="sf-docker-tag-badge">{{ tag.badge }}</span>
    </div>
  </div>
</template>