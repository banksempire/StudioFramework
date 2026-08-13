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
  /** Mobile bottom dock: dragging vertically moves the status bar with
   *  the finger (dy = finger delta, positive = downward). */
  'status-drag': [dy: number];
  /** Release: settle the status bar — true = show, false = hide. */
  'status-settle': [show: boolean];
}>();

// ── Status-bar swipe (mobile) ────────────────────────────────────────────
// CONTINUOUS drag: every touchmove reports the finger's vertical delta
// (the framework maps it 1:1 to the status bar's reveal), and on release
// the settle direction comes from the release velocity (a flick wins
// over distance) or, for slow releases, from the displacement: less than
// half the slot snaps back to visible, more hides. A tap (no move) still
// reaches the app's click handler.
const STATUS_SLOT = 33; // 25px bar + 8px gap — the status bar's layout slot (mirrors Framework.vue)
const VELOCITY_WINS = 0.4; // px/ms — a faster release flicks past the half-slot threshold
const swipe = { x: 0, y: 0, t: 0, active: false };

function onTouchStart(e: TouchEvent) {
  if (props.position !== 'bottom' || e.touches.length !== 1) return;
  const t = e.touches[0];
  swipe.x = t.clientX;
  swipe.y = t.clientY;
  swipe.t = performance.now();
  swipe.active = true;
}

function onTouchMove(e: TouchEvent) {
  if (!swipe.active) return;
  const t = e.touches[0];
  emit('status-drag', t.clientY - swipe.y);
}

function onTouchEnd(e: TouchEvent) {
  if (!swipe.active) return;
  swipe.active = false;
  const t = e.changedTouches[0];
  const dy = t.clientY - swipe.y;
  const dx = t.clientX - swipe.x;
  // Horizontal intent (the dock scrolls sideways) — leave the bar alone.
  if (Math.abs(dx) > Math.abs(dy)) return;
  const elapsed = performance.now() - swipe.t;
  const velocity = elapsed > 0 ? dy / elapsed : 0; // px/ms, positive = downward
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
