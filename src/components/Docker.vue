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
//
// Touch slop: browsers withhold the first ~10px of movement and deliver
// it in ONE late touchmove — without anchoring, that move would jump the
// reveal (on a swipe-up from hidden it clamps straight to 1 = the bar
// pops open). So the first dispatched move only ESTABLISHES the drag
// anchor (the reveal stays put) and tracking is 1:1 from there — unless
// that first move is fast enough to be a genuine flick, which should
// count as movement (anchoring would swallow the whole flick).
const STATUS_SLOT = 33; // 25px bar + 8px gap — the status bar's layout slot (mirrors Framework.vue)
const VELOCITY_WINS = 0.4; // px/ms — a faster release flicks past the half-slot threshold
const FLICK_VELOCITY = 0.6; // px/ms — a first move this fast is a flick, not slop
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
  const now = performance.now();
  const raw = t.clientY - swipe.y;
  if (!swipe.moved) {
    swipe.moved = true;
    const v0 = now > swipe.t ? raw / (now - swipe.t) : 0;
    swipe.anchor = Math.abs(v0) > FLICK_VELOCITY ? 0 : raw;
  }
  emit('status-drag', raw - swipe.anchor);
}

function onTouchEnd(e: TouchEvent) {
  if (!swipe.active) return;
  swipe.active = false;
  const t = e.changedTouches[0];
  const dy = t.clientY - swipe.y - swipe.anchor;
  const dx = t.clientX - swipe.x;
  // Horizontal intent (the dock scrolls sideways) — leave the bar alone.
  if (Math.abs(dx) > Math.abs(dy)) return;
  const elapsed = performance.now() - swipe.t;
  const velocity = elapsed > 0 ? (t.clientY - swipe.y) / elapsed : 0; // px/ms, positive = downward
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
