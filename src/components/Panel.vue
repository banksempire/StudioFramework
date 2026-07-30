<script setup lang="ts">
import { computed } from 'vue';
import { useResize } from '../composables/useResize.js';

const props = withDefaults(defineProps<{
  title: string;
  visible: boolean;
  position: 'left' | 'right';
}>(), {
  visible: true,
});

const emit = defineEmits<{
  'collapse': [];
}>();

const resizeDir = computed(() => props.position === 'left' ? 'right' : 'left');
const oppositeEdge = computed(() => props.position === 'left' ? 'left' : 'right');

const MIN_WIDTH = 150;
const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: MIN_WIDTH,
  max: 500,
  direction: resizeDir.value,
  collapseThreshold: Math.round(MIN_WIDTH * 2 / 3),
  onCollapse: () => emit('collapse'),
});
</script>

<template>
  <div
    v-if="visible"
    class="sf-panel"
    :class="[
      'sf-panel--' + position,
      {
        'sf-panel--dragging': dragging,
        'sf-panel--will-collapse': willCollapse,
      },
    ]"
    :data-collapse-edge="willCollapse ? oppositeEdge : undefined"
    :style="{ width: width + 'px' }"
  >
    <div
      class="sf-panel-resize-handle"
      :class="'sf-panel-resize-handle--' + resizeDir"
      @mousedown="onMouseDown"
    />

    <div class="sf-panel-header">
      <span class="sf-panel-title">{{ title }}</span>
    </div>
  </div>
</template>
