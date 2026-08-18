<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import type { IconDef } from '../types/panel';
import Icon from './Icon.vue';
import SvgIcon from './SvgIcon.vue';

export interface TabDropdownItem {
  id: string;
  label: string;
  icon?: IconDef;
  closeable?: boolean;
}

const props = withDefaults(
  defineProps<{
    open?: boolean;
    items: TabDropdownItem[];
    activeId?: string | null;
  }>(),
  { open: false, activeId: null },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [id: string];
  close: [id: string];
}>();

const SWIPE_REVEAL = 86;

interface SwipeState {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  active: boolean;
  revealed: boolean;
}

const rows = reactive<Record<string, SwipeState>>({});
const suppressedClick = ref<string | null>(null);

function stateOf(id: string): SwipeState {
  if (!rows[id]) rows[id] = { startX: 0, startY: 0, dx: 0, dy: 0, active: false, revealed: false };
  return rows[id];
}

function clampSwipe(v: number): number {
  return Math.max(-SWIPE_REVEAL, Math.min(0, v));
}

function swipeOffset(id: string): number {
  const s = rows[id];
  if (!s) return 0;
  if (s.active) {
    const base = s.revealed ? -SWIPE_REVEAL : 0;
    return clampSwipe(base + s.dx);
  }
  return s.revealed ? -SWIPE_REVEAL : 0;
}

function slideStyle(id: string) {
  const s = rows[id];
  if (!s || (!s.active && !s.revealed)) return undefined;
  return { transform: `translate3d(${swipeOffset(id)}px, 0, 0)` };
}

function onDown(e: PointerEvent, id: string) {
  const item = props.items.find((t) => t.id === id);
  if (!item || item.closeable === false) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const s = stateOf(id);
  s.startX = e.clientX;
  s.startY = e.clientY;
  s.dx = 0;
  s.dy = 0;
  s.active = false;
}

function onMove(e: PointerEvent, id: string) {
  const s = rows[id];
  if (!s) return;
  s.dx = e.clientX - s.startX;
  s.dy = e.clientY - s.startY;
  if (!s.active) {
    if (Math.abs(s.dx) < 6 || Math.abs(s.dx) < Math.abs(s.dy)) return;
    s.active = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    for (const k of Object.keys(rows)) {
      if (k !== id) rows[k].revealed = false;
    }
  }
}

function onUp(id: string) {
  const s = rows[id];
  if (!s) return;
  if (s.active) {
    const base = s.revealed ? -SWIPE_REVEAL : 0;
    const off = clampSwipe(base + s.dx);
    s.revealed = off < -SWIPE_REVEAL / 2;
    suppressedClick.value = id;
  }
  s.active = false;
}

function onSlideClick(id: string) {
  if (suppressedClick.value === id) {
    suppressedClick.value = null;
    return;
  }
  emit('select', id);
  emit('update:open', false);
}

function onClose(id: string) {
  const s = rows[id];
  if (s) s.revealed = false;
  emit('close', id);
}

function closeSheet() {
  emit('update:open', false);
}

function isSwiping(id: string): boolean {
  return rows[id]?.active ?? false;
}

function isRevealed(id: string): boolean {
  return rows[id]?.revealed ?? false;
}

function isBtnVisible(id: string): boolean {
  const s = rows[id];
  if (!s) return false;
  if (s.revealed) return true;
  return s.active && swipeOffset(id) < -4;
}

watch(
  () => props.open,
  (o) => {
    if (o) return;
    for (const k of Object.keys(rows)) {
      rows[k].active = false;
      rows[k].revealed = false;
      rows[k].dx = 0;
    }
    suppressedClick.value = null;
  },
);

const sheetTarget = ref<HTMLElement | 'body'>('body');
onMounted(() => {
  sheetTarget.value = (document.querySelector('.sf-root') as HTMLElement | null) ?? 'body';
});
</script>

<template>
  <Teleport :to="sheetTarget">
    <div v-if="open" class="sf-tab-dropdown">
      <div class="sf-tab-dropdown-bar">
        <span class="sf-tab-dropdown-title">tabs</span>
        <button class="sf-tab-dropdown-close" title="Close" @click="closeSheet">
          <SvgIcon name="✕" />
        </button>
      </div>
      <div class="sf-tab-dropdown-body">
        <div class="sf-tab-dropdown-list">
          <div
            v-for="tab in items"
            :key="tab.id"
            class="sf-tab-dropdown-row"
            :class="{ 'sf-tab-dropdown-row--revealed': isRevealed(tab.id) }"
          >
            <button
              v-if="tab.closeable !== false"
              class="sf-tab-dropdown-close-btn"
              :class="{
                revealed: isRevealed(tab.id),
                active: isBtnVisible(tab.id),
              }"
              title="Close tab"
              @click.stop="onClose(tab.id)"
            >
              <SvgIcon name="✕" />
              <span>Close</span>
            </button>
            <div
              class="sf-tab-dropdown-slide"
              :class="{ 'sf-tab-dropdown-slide--swiping': isSwiping(tab.id) }"
              :style="slideStyle(tab.id)"
              @pointerdown="onDown($event, tab.id)"
              @pointermove="onMove($event, tab.id)"
              @pointerup="onUp(tab.id)"
              @pointercancel="onUp(tab.id)"
              @click="onSlideClick(tab.id)"
            >
              <span v-if="tab.id === activeId" class="sf-tab-dropdown-mark" />
              <span class="sf-tab-dropdown-icon">
                <Icon v-if="tab.icon" :icon="tab.icon" />
              </span>
              <span class="sf-tab-dropdown-label">{{ tab.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
