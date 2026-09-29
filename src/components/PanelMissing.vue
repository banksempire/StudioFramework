<script setup lang="ts">
import { computed } from 'vue';
import { PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, useResize } from '../composables/useResize';
import SvgIcon from './SvgIcon.vue';

const props = defineProps<{
  width: number;
  visible: boolean;
  position?: 'left' | 'right';
  title?: string;
  mobileClose?: boolean;
}>();

const emit = defineEmits<{ resize: [width: number]; collapse: []; close: [] }>();

const side = computed(() => props.position ?? 'right');
const oppositeEdge = computed(() => (side.value === 'left' ? 'left' : 'right'));
const resizeDir = computed(() => (side.value === 'left' ? 'right' : 'left'));
const {
  width: panelWidth,
  dragging,
  willCollapse,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = useResize({
  min: PANEL_MIN_WIDTH,
  max: PANEL_MAX_WIDTH,
  initial: props.width,
  direction: resizeDir.value,
  collapseThreshold: Math.round((PANEL_MIN_WIDTH * 2) / 3),
  onCollapse: () => emit('collapse'),
  onResize: (w) => emit('resize', w),
});
</script>

<template>
  <div
    class="sf-panel"
    :class="[
      'sf-panel--missing',
      'sf-panel--' + side,
      {
        'sf-panel--dragging': dragging,
        'sf-panel--will-collapse': willCollapse,
        'sf-panel--hidden': !visible,
      },
    ]"
    :style="{ width: panelWidth + 'px' }"
  >
    <div
      class="sf-panel-resize-handle"
      :class="'sf-panel-resize-handle--' + resizeDir"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    />
    <div class="sf-panel-header">
      <span class="sf-panel-title">{{ title ?? 'Info Panel' }}</span>
      <button
        v-if="props.mobileClose"
        class="sf-panel-close-btn"
        title="Close panel"
        @click="emit('close')"
      ><SvgIcon name="✕" /></button>
    </div>
    <div class="sf-panel-missing">Panel layout undefined</div>
    <div
      v-if="willCollapse"
      class="sf-panel-dtc-overlay"
      :class="'sf-panel-dtc-overlay--' + oppositeEdge"
    />
  </div>
</template>
