<script setup lang="ts">
import type { DockerAppDef } from '../types/layout';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    items: DockerAppDef[];
    activeApp: string;
    panelVisible?: boolean;
    position?: 'left' | 'bottom';
  }>(),
  {
    panelVisible: true,
    position: 'left',
  },
);

const emit = defineEmits<{
  'app-selected': [appId: string];
  'status-drag': [dy: number];
  'status-settle': [show: boolean];
}>();

const STATUS_SLOT = 38;
const DRAG_START = 6;
const VELOCITY_WINS = 0.4;
const FLICK_VELOCITY = 0.6;
const swipe = { x: 0, y: 0, t: 0, active: false, moved: false, anchor: 0 };

function onTouchStart(e: TouchEvent) {
  if (props.position !== 'bottom' || e.touches.length !== 1) return;
  const t = e.touches[0];
  swipe.x = t.clientX;
  swipe.y = t.clientY;
  swipe.t = performance.now();
  swipe.moved = false;
  swipe.anchor = 0;
  swipe.active = true;
}

function onTouchMove(e: TouchEvent) {
  if (!swipe.active) return;
  const t = e.touches[0];
  const raw = t.clientY - swipe.y;
  const dx = t.clientX - swipe.x;
  if (!swipe.moved) {
    if (Math.abs(raw) < DRAG_START || Math.abs(dx) > Math.abs(raw)) return;
    swipe.moved = true;
    const now = performance.now();
    const v0 = now > swipe.t ? raw / (now - swipe.t) : 0;
    swipe.anchor = Math.abs(v0) > FLICK_VELOCITY ? 0 : raw;
  }
  emit('status-drag', raw - swipe.anchor);
}

function onTouchEnd(e: TouchEvent) {
  if (!swipe.active) return;
  swipe.active = false;
  if (!swipe.moved) return;
  const t = e.changedTouches[0];
  const dy = t.clientY - swipe.y - swipe.anchor;
  const elapsed = performance.now() - swipe.t;
  const velocity = elapsed > 0 ? (t.clientY - swipe.y) / elapsed : 0;
  const show = velocity < -VELOCITY_WINS ? true : velocity > VELOCITY_WINS ? false : dy < STATUS_SLOT / 2;
  emit('status-settle', show);
}
</script>

<template>
  <div
    class="sf-docker"
    :class="{ 'sf-docker--bottom': position === 'bottom' }"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
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
