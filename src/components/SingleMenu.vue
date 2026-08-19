<script setup lang="ts" generic="T">
import { computed, nextTick, onMounted, onUnmounted, reactive, type Ref, ref, watch } from 'vue';
import type { SingleMenuOption } from '../types/singleMenu';
import Icon from './Icon.vue';
import SvgIcon from './SvgIcon.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    items: T[];
    options: (item: T) => SingleMenuOption[];
    keyOf?: (item: T) => string;
    titleOf?: (item: T) => string;
    draggable?: boolean;
    revealWidth?: number;
  }>(),
  {
    draggable: false,
    revealWidth: 86,
  },
);

const emit = defineEmits<{
  activate: [item: T];
  select: [item: T, option: SingleMenuOption];
  dragstart: [item: T, event: DragEvent];
  dragend: [event: DragEvent];
}>();

function rowKey(item: T, index: number): string {
  if (props.keyOf) return props.keyOf(item);
  if (item !== null && typeof item === 'object' && 'id' in item) return String((item as { id: unknown }).id);
  return String(item ?? index);
}

interface RowView<TItem> {
  key: string;
  item: TItem;
  index: number;
  opts: SingleMenuOption[];
}

const rowViews = computed<RowView<T>[]>(() =>
  props.items.map((item, index) => ({
    key: rowKey(item, index),
    item,
    index,
    opts: props.options(item) ?? [],
  })),
);

function optsOf(item: T): SingleMenuOption[] {
  const row = rowViews.value.find((r) => r.item === item);
  return row ? row.opts : (props.options(item) ?? []);
}

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

function stateOf(key: string): SwipeState {
  if (!rows[key]) rows[key] = { startX: 0, startY: 0, dx: 0, dy: 0, active: false, revealed: false };
  return rows[key];
}

function clampSwipe(v: number): number {
  return Math.max(-props.revealWidth, Math.min(0, v));
}

function swipeOffset(key: string): number {
  const s = rows[key];
  if (!s) return 0;
  if (s.active) return clampSwipe((s.revealed ? -props.revealWidth : 0) + s.dx);
  return s.revealed ? -props.revealWidth : 0;
}

function slideStyle(key: string) {
  const s = rows[key];
  if (!s || (!s.active && !s.revealed)) return undefined;
  return { transform: `translate3d(${swipeOffset(key)}px, 0, 0)` };
}

function isSwiping(key: string): boolean {
  return rows[key]?.active ?? false;
}

function isRevealed(key: string): boolean {
  return rows[key]?.revealed ?? false;
}

function isUnderVisible(key: string): boolean {
  const s = rows[key];
  if (!s) return false;
  if (s.revealed) return true;
  return s.active && swipeOffset(key) < -4;
}

let lastPointerType = '';

function onDown(e: PointerEvent, row: RowView<T>) {
  lastPointerType = e.pointerType;
  if (e.pointerType === 'mouse' || e.button !== 0 || row.opts.length === 0) return;
  const s = stateOf(row.key);
  s.startX = e.clientX;
  s.startY = e.clientY;
  s.dx = 0;
  s.dy = 0;
  s.active = false;
}

function onMove(e: PointerEvent, key: string) {
  const s = rows[key];
  if (!s) return;
  s.dx = e.clientX - s.startX;
  s.dy = e.clientY - s.startY;
  if (!s.active) {
    if (Math.abs(s.dx) < 6 || Math.abs(s.dx) < Math.abs(s.dy)) return;
    s.active = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    for (const k of Object.keys(rows)) {
      if (k !== key) rows[k].revealed = false;
    }
  }
}

function onUp(row: RowView<T>) {
  const s = rows[row.key];
  if (!s) return;
  if (s.active) {
    const base = s.revealed ? -props.revealWidth : 0;
    const off = clampSwipe(base + s.dx);
    const opened = off < -props.revealWidth / 2;
    s.revealed = opened && row.opts.length === 1;
    if (opened && row.opts.length > 1) dialogItem.value = row.item;
    suppressedClick.value = row.key;
  }
  s.active = false;
}

function onSlideClick(row: RowView<T>) {
  if (suppressedClick.value === row.key) {
    suppressedClick.value = null;
    return;
  }
  emit('activate', row.item);
}

function onUnderTap(row: RowView<T>) {
  const s = rows[row.key];
  if (s) s.revealed = false;
  const opt = row.opts[0];
  if (opt) emit('select', row.item, opt);
}

const ctxItem = ref(null) as Ref<T | null>;
const ctxX = ref(0);
const ctxY = ref(0);
const menuEl = ref<HTMLElement | null>(null);
const menuStyle = ref<{ left: string; top: string }>({ left: '0px', top: '0px' });

function onCtx(e: MouseEvent, row: RowView<T>) {
  if (row.opts.length === 0) return;
  e.preventDefault();
  const fromTouch = lastPointerType !== '' && lastPointerType !== 'mouse';
  lastPointerType = '';
  if (fromTouch) return;
  dialogItem.value = null;
  ctxItem.value = row.item;
  ctxX.value = e.clientX;
  ctxY.value = e.clientY;
}

watch(ctxItem, async (v) => {
  if (!v) return;
  await nextTick();
  const el = menuEl.value;
  if (!el) return;
  const w = el.offsetWidth || 200;
  const h = el.offsetHeight || 80;
  const left = Math.max(4, Math.min(ctxX.value, window.innerWidth - w - 4));
  const top = Math.max(4, Math.min(ctxY.value, window.innerHeight - h - 4));
  menuStyle.value = { left: `${left}px`, top: `${top}px` };
});

const dialogItem = ref(null) as Ref<T | null>;
const dialogTitle = computed(() => {
  const item = dialogItem.value;
  return item !== null && props.titleOf ? String(props.titleOf(item) ?? '') : '';
});

function closeAll() {
  ctxItem.value = null;
  dialogItem.value = null;
}

function pick(item: T | null, opt: SingleMenuOption) {
  if (item === null || opt.disabled) return;
  closeAll();
  emit('select', item, opt);
}

function onDocDown(e: MouseEvent) {
  if (ctxItem.value === null) return;
  if (menuEl.value?.contains(e.target as Node)) return;
  ctxItem.value = null;
}

function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeAll();
}

watch(rowViews, (views) => {
  const keys = new Set(views.map((v) => v.key));
  for (const k of Object.keys(rows)) {
    if (!keys.has(k)) delete rows[k];
  }
  if (ctxItem.value !== null && !props.items.includes(ctxItem.value)) ctxItem.value = null;
  if (dialogItem.value !== null && !props.items.includes(dialogItem.value)) dialogItem.value = null;
  if (suppressedClick.value && !keys.has(suppressedClick.value)) suppressedClick.value = null;
});

const sheetTarget = ref<HTMLElement | 'body'>('body');

if (typeof window !== 'undefined') {
  onMounted(() => {
    sheetTarget.value = (document.querySelector('.sf-root') as HTMLElement | null) ?? 'body';
    window.addEventListener('mousedown', onDocDown);
    window.addEventListener('keydown', onDocKey);
  });
  onUnmounted(() => {
    window.removeEventListener('mousedown', onDocDown);
    window.removeEventListener('keydown', onDocKey);
  });
}
</script>

<template>
  <div class="sf-sm" v-bind="$attrs">
    <div v-for="row in rowViews" :key="row.key" class="sf-sm-row">
      <div
        v-if="row.opts.length > 0"
        class="sf-sm-under"
        :class="{
          'sf-sm-under--revealed': isRevealed(row.key),
          'sf-sm-under--active': isUnderVisible(row.key),
        }"
        :style="{ width: `${revealWidth}px` }"
      >
        <button
          v-if="row.opts.length === 1"
          class="sf-sm-act"
          :class="{ 'sf-sm-act--danger': row.opts[0].danger }"
          :title="row.opts[0].label ?? row.opts[0].id"
          @click.stop="onUnderTap(row)"
        >
          <Icon :icon="row.opts[0].icon" />
          <span>{{ row.opts[0].label ?? row.opts[0].id }}</span>
        </button>
        <div v-else class="sf-sm-act sf-sm-act--more" title="More">
          <SvgIcon name="⋯" />
          <span>More</span>
        </div>
      </div>
      <div
        class="sf-sm-slide"
        :class="{ 'sf-sm-slide--swiping': isSwiping(row.key) }"
        :style="slideStyle(row.key)"
        :draggable="draggable"
        @pointerdown="onDown($event, row)"
        @pointermove="onMove($event, row.key)"
        @pointerup="onUp(row)"
        @pointercancel="onUp(row)"
        @click="onSlideClick(row)"
        @contextmenu="onCtx($event, row)"
        @dragstart="emit('dragstart', row.item, $event)"
        @dragend="emit('dragend', $event)"
      >
        <slot name="item" :item="row.item" :index="row.index" />
      </div>
    </div>
  </div>

  <Teleport :to="sheetTarget">
    <div v-if="ctxItem !== null" ref="menuEl" class="sf-sm-menu" :style="menuStyle" role="menu">
      <button
        v-for="opt in optsOf(ctxItem)"
        :key="opt.id"
        class="sf-sm-menu-row"
        :class="{
          'sf-sm-menu-row--danger': opt.danger,
          'sf-sm-menu-row--disabled': opt.disabled,
        }"
        role="menuitem"
        :disabled="opt.disabled"
        @click="pick(ctxItem, opt)"
      >
        <Icon :icon="opt.icon" />
        <span>{{ opt.label ?? opt.id }}</span>
      </button>
    </div>

    <div v-if="dialogItem !== null" class="sf-sm-dialog-backdrop" @click.self="dialogItem = null">
      <div class="sf-sm-dialog" role="dialog">
        <div v-if="dialogTitle" class="sf-sm-dialog-title">{{ dialogTitle }}</div>
        <button
          v-for="opt in optsOf(dialogItem)"
          :key="opt.id"
          class="sf-sm-menu-row sf-sm-dialog-row"
          :class="{
            'sf-sm-menu-row--danger': opt.danger,
            'sf-sm-menu-row--disabled': opt.disabled,
          }"
          :disabled="opt.disabled"
          @click="pick(dialogItem, opt)"
        >
          <Icon :icon="opt.icon" />
          <span>{{ opt.label ?? opt.id }}</span>
        </button>
        <button class="sf-sm-dialog-cancel" @click="dialogItem = null">Cancel</button>
      </div>
    </div>
  </Teleport>
</template>
