<script setup lang="ts">
import type { DockerAppDef } from '../types/layout';
import Icon from './Icon.vue';

const props = withDefaults(
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
  /** Mobile bottom dock: a vertical swipe toggles the status bar — swipe
   *  up shows it, swipe down hides it. */
  'status-swipe': ['up' | 'down'];
}>();

// ── Status-bar swipe (mobile) ────────────────────────────────────────────
// Track the touch from start to end and decide by the NET displacement:
// a dominant vertical move of >= SWIPE_THRESHOLD px counts — up (finger
// moves up) shows the status bar, down hides it. No move = a tap, which
// still reaches the app's click handler.
const SWIPE_THRESHOLD = 24;
const swipeStart = { x: 0, y: 0, active: false };

function onTouchStart(e: TouchEvent) {
  if (props.position !== 'bottom' || e.touches.length !== 1) return;
  const t = e.touches[0];
  swipeStart.x = t.clientX;
  swipeStart.y = t.clientY;
  swipeStart.active = true;
}

function onTouchEnd(e: TouchEvent) {
  if (!swipeStart.active) return;
  swipeStart.active = false;
  const t = e.changedTouches[0];
  const dy = t.clientY - swipeStart.y;
  const dx = t.clientX - swipeStart.x;
  if (Math.abs(dy) < SWIPE_THRESHOLD || Math.abs(dx) > Math.abs(dy)) return;
  emit('status-swipe', dy < 0 ? 'up' : 'down');
}
</script>

<template>
  <div
    class="sf-docker"
    :class="{ 'sf-docker--bottom': position === 'bottom' }"
    @touchstart.passive="onTouchStart"
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
