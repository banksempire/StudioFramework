<script setup lang="ts">
import { computed } from 'vue';
import { useResize } from '../composables/useResize.js';

const props = defineProps<{
  title: string;
  visible: boolean;
  position: 'left' | 'right';
}>();

const emit = defineEmits<{
  'collapse': [];
}>();

const resizeDir = computed(() => props.position === 'left' ? 'right' : 'left');
const oppositeEdge = computed(() => props.position === 'left' ? 'left' : 'right');

const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: 180,
  max: 500,
  direction: resizeDir.value,
  onCollapse: () => emit('collapse'),
});
</script>

<template>
  <div
    class="sf-panel"
    :class="[
      'sf-panel--' + position,
      {
        'sf-panel--hidden': !visible,
        'sf-panel--dragging': dragging,
        'sf-panel--will-collapse': willCollapse,
      },
    ]"
    :data-collapse-edge="willCollapse ? oppositeEdge : undefined"
    :style="visible ? { width: width + 'px' } : {}"
  >
    <div
      class="sf-panel-resize-handle"
      :class="'sf-panel-resize-handle--' + resizeDir"
      @mousedown="onMouseDown"
    />

    <div class="sf-panel-header">
      <span class="sf-panel-title">{{ title }}</span>
    </div>

    <div class="sf-panel-content">
      <slot />
    </div>
  </div>
</template>
