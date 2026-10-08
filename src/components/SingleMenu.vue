<script setup lang="ts" generic="T">
import { computed, inject, nextTick, onMounted, onUnmounted, type Ref, ref, watch } from 'vue';
import type { SingleMenuOption } from '../types/singleMenu';
import Icon from './Icon.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    items: T[];
    options: (item: T) => SingleMenuOption[];
    keyOf?: (item: T) => string;
    titleOf?: (item: T) => string;
    draggable?: boolean;
  }>(),
  {
    draggable: false,
  },
);

const emit = defineEmits<{
  activate: [item: T];
  select: [item: T, option: SingleMenuOption];
  dragstart: [item: T, event: DragEvent];
  dragend: [event: DragEvent];
}>();

function stableKey(item: T): string | null {
  if (props.keyOf) return props.keyOf(item);
  if (item !== null && typeof item === 'object') {
    return 'id' in item ? String((item as { id: unknown }).id) : null;
  }
  if (item === null || item === undefined) return null;
  return String(item);
}

function rowKey(item: T, index: number): string {
  return stableKey(item) ?? String(item ?? index);
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

const optsByKey = computed(() => new Map(rowViews.value.map((r) => [r.key, r.opts])));

function optsOf(item: T): SingleMenuOption[] {
  const key = stableKey(item);
  if (key === null) return [];
  return optsByKey.value.get(key) ?? [];
}

function openRow(row: RowView<T>, x: number, y: number) {
  if (row.opts.length === 0) return;
  ctxItem.value = row.item;
  ctxX.value = x;
  ctxY.value = y;
}

let lastPointerType = '';

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
  openRow(row, e.clientX, e.clientY);
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

function closeAll() {
  ctxItem.value = null;
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

watch(rowViews, (rows) => {
  const rebind = (item: T | null): T | null => {
    if (item === null) return null;
    if (rows.some((r) => r.item === item)) return item;
    const key = stableKey(item);
    if (key === null) return null;
    const hit = rows.find((r) => r.key === key);
    return hit ? hit.item : null;
  };
  ctxItem.value = rebind(ctxItem.value);
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
        class="sf-sm-slide"
        :draggable="draggable"
        @pointerdown="lastPointerType = $event.pointerType"
        @click="emit('activate', row.item)"
        @contextmenu="onCtx($event, row)"
        @dragstart="emit('dragstart', row.item, $event)"
        @dragend="emit('dragend', $event)"
      >
        <div class="sf-sm-content">
          <slot
          name="item"
          :item="row.item"
          :index="row.index"
          :open-menu="(x: number, y: number) => openRow(row, x, y)"
        />
        </div>
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

  </Teleport>
</template>
