<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
  reorder: [id: string, toIndex: number];
}>();

const LONG_PRESS_MS = 500;
const SLOP_PX = 10;

const order = ref<string[]>([]);
const dragId = ref<string | null>(null);
const dragTy = ref(0);
const hoverIndex = ref(-1);
const listEl = ref<HTMLElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);

const orderedItems = computed(() => {
  const byId = new Map(props.items.map((t) => [t.id, t]));
  const known = order.value.map((id) => byId.get(id)).filter((t) => t !== undefined);
  for (const t of props.items) if (!order.value.includes(t.id)) known.push(t);
  return known;
});

watch(
  () => props.items,
  (items) => {
    if (dragId.value !== null) return;
    order.value = items.map((t) => t.id);
  },
  { immediate: true },
);

interface PressState {
  id: string;
  index: number;
  el: HTMLElement;
  pointerId: number;
  x: number;
  y: number;
}

let press: PressState | null = null;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let heldFired = false;
let dragging = false;
let baseTop = 0;
let rowStep = 61;
let rowH = 60;
let rowsExtent = 0;
let touchBlock: ((e: TouchEvent) => void) | null = null;
let suppressClick = false;

function clearHold() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
}

function blockScroll(e: TouchEvent) {
  if (dragging) e.preventDefault();
}

function startBlockScroll() {
  touchBlock = blockScroll;
  listEl.value?.addEventListener('touchmove', touchBlock, { passive: false });
}

function stopBlockScroll() {
  if (touchBlock && listEl.value) listEl.value.removeEventListener('touchmove', touchBlock);
  touchBlock = null;
}

function startReorder() {
  holdTimer = null;
  if (!press) return;
  heldFired = true;
  dragging = true;
  dragId.value = press.id;
  hoverIndex.value = press.index;
  dragTy.value = 0;
  rowH = press.el.offsetHeight;
  const first = listEl.value?.firstElementChild as HTMLElement | null;
  const second = first?.nextElementSibling as HTMLElement | null;
  rowStep =
    first && second ? second.getBoundingClientRect().top - first.getBoundingClientRect().top : rowH + 1;
  rowsExtent = order.value.length * rowStep;
  baseTop = localTop(press.el);
  startBlockScroll();
  navigator.vibrate?.(12);
}

function localTop(el: HTMLElement): number {
  const list = listEl.value;
  if (!list) return el.offsetTop;
  return el.getBoundingClientRect().top - list.getBoundingClientRect().top;
}

function stopReorder() {
  dragging = false;
  dragId.value = null;
  hoverIndex.value = -1;
  dragTy.value = 0;
  stopBlockScroll();
}

function finishReorder() {
  const id = dragId.value;
  const from = id ? order.value.indexOf(id) : -1;
  const to = hoverIndex.value;
  stopReorder();
  if (!id || from < 0 || to < 0 || from === to) return;
  const next = order.value.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  order.value = next;
  suppressClick = true;
  setTimeout(() => {
    suppressClick = false;
  }, 0);
  emit('reorder', id, to);
}

function autoScroll(clientY: number) {
  const body = bodyEl.value;
  if (!body) return;
  const r = body.getBoundingClientRect();
  if (clientY < r.top + 48) body.scrollTop -= 8;
  else if (clientY > r.bottom - 48) body.scrollTop += 8;
}

function onRowPointerDown(e: PointerEvent, item: TabDropdownItem) {
  if (dragging) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if ((e.target as HTMLElement).closest('.sf-tab-dropdown-rowclose')) return;
  clearHold();
  heldFired = false;
  const el = e.currentTarget as HTMLElement;
  press = {
    id: item.id,
    index: order.value.indexOf(item.id),
    el,
    pointerId: e.pointerId,
    x: e.clientX,
    y: e.clientY,
  };
  try {
    el.setPointerCapture(e.pointerId);
  } catch {}
  holdTimer = setTimeout(startReorder, LONG_PRESS_MS);
}

function onRowPointerMove(e: PointerEvent) {
  if (!press || e.pointerId !== press.pointerId) return;
  if (!dragging) {
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (dx * dx + dy * dy > SLOP_PX * SLOP_PX) {
      clearHold();
      press = null;
    }
    return;
  }
  const dy = e.clientY - press.y;
  const ty = Math.min(Math.max(dy, -baseTop), rowsExtent - rowH - baseTop);
  dragTy.value = ty;
  hoverIndex.value = Math.min(Math.max(Math.round((baseTop + ty) / rowStep), 0), order.value.length - 1);
  autoScroll(e.clientY);
}

function onRowPointerUp(e: PointerEvent) {
  if (!press || e.pointerId !== press.pointerId) return;
  if (dragging) finishReorder();
  clearHold();
  press = null;
}

function onRowPointerCancel(e: PointerEvent) {
  if (!press || e.pointerId !== press.pointerId) return;
  if (dragging) stopReorder();
  clearHold();
  press = null;
}

function rowShift(id: string): number {
  if (dragId.value === null || hoverIndex.value < 0) return 0;
  const from = order.value.indexOf(dragId.value);
  const i = order.value.indexOf(id);
  if (i < 0 || i === from) return 0;
  if (hoverIndex.value < from && i >= hoverIndex.value && i < from) return rowStep;
  if (hoverIndex.value > from && i > from && i <= hoverIndex.value) return -rowStep;
  return 0;
}

function rowStyle(id: string): Record<string, string> {
  if (id === dragId.value) return { transform: `translateY(${dragTy.value}px)` };
  const shift = rowShift(id);
  if (shift !== 0) return { transform: `translateY(${shift}px)` };
  return {};
}

function onRowClick(item: TabDropdownItem) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (heldFired) {
    heldFired = false;
    return;
  }
  emit('select', item.id);
  emit('update:open', false);
}

function closeSheet() {
  emit('update:open', false);
}

watch(
  () => props.open,
  (o) => {
    if (o) return;
    clearHold();
    if (dragging) stopReorder();
    press = null;
    heldFired = false;
  },
);

onBeforeUnmount(() => {
  clearHold();
  stopBlockScroll();
});

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
      <div
        ref="bodyEl"
        class="sf-tab-dropdown-body"
        :class="{ 'sf-tab-dropdown-body--dragging': dragId !== null }"
      >
        <div
          ref="listEl"
          class="sf-tab-dropdown-list"
          :class="{ 'sf-tab-dropdown-list--reordering': dragId !== null }"
        >
          <div
            v-for="tab in orderedItems"
            :key="tab.id"
            class="sf-tab-dropdown-row"
            :class="{ 'sf-tab-dropdown-row--dragging': tab.id === dragId }"
            :data-tab-id="tab.id"
            :style="rowStyle(tab.id)"
            @click="onRowClick(tab)"
            @pointerdown="onRowPointerDown($event, tab)"
            @pointermove="onRowPointerMove"
            @pointerup="onRowPointerUp"
            @pointercancel="onRowPointerCancel"
            @contextmenu.prevent
          >
            <span v-if="tab.id === activeId" class="sf-tab-dropdown-mark" />
            <span class="sf-tab-dropdown-icon">
              <Icon v-if="tab.icon" :icon="tab.icon" />
            </span>
            <span class="sf-tab-dropdown-label">{{ tab.label }}</span>
            <button
              v-if="tab.closeable !== false"
              class="sf-tab-dropdown-rowclose"
              title="Close tab"
              aria-label="Close tab"
              @click.stop="emit('close', tab.id)"
            >
              <SvgIcon name="✕" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
