<script setup lang="ts" generic="T">
import { computed, nextTick, onMounted, onUnmounted, type Ref, ref, watch } from 'vue';
import { useSwipeReveal } from '../composables/useSwipeReveal';
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

const optsByItem = computed(() => new Map(rowViews.value.map((r) => [r.item, r.opts])));
const rowByKey = computed(() => new Map(rowViews.value.map((r) => [r.key, r])));

function optsOf(item: T): SingleMenuOption[] {
  return optsByItem.value.get(item) ?? [];
}

const underStyleOf = (key: string) => ({ width: `${underWidth(key)}px` });

const dialogItem = ref(null) as Ref<T | null>;
const dialogTitle = computed(() => {
  const item = dialogItem.value;
  return item !== null && props.titleOf ? String(props.titleOf(item) ?? '') : '';
});

const listEl = ref<HTMLElement | null>(null);

const swipe = useSwipeReveal({
  revealWidth: () => props.revealWidth,
  rowWidth: () => listEl.value?.offsetWidth ?? 0,
  commitStyle: (key) => ((rowByKey.value.get(key)?.opts.length ?? 0) === 1 ? 'execute' : 'menu'),
  onCommit: (key) => {
    const row = rowByKey.value.get(key);
    if (!row || row.opts.length === 0) return;
    if (row.opts.length === 1) emit('select', row.item, row.opts[0]);
    else dialogItem.value = row.item;
  },
});
const {
  styleOf: slideStyle,
  underWidth,
  isSwiping,
  isRevealed,
  isLayerVisible: isUnderVisible,
  isArmed,
} = swipe;

let lastPointerType = '';

function onDown(e: PointerEvent, row: RowView<T>) {
  lastPointerType = e.pointerType;
  if (e.pointerType === 'mouse' || e.button !== 0 || row.opts.length === 0) return;
  swipe.begin(row.key, e);
}

function onUp(e: PointerEvent, row: RowView<T>) {
  swipe.end(row.key, e);
}

function onSlideClick(row: RowView<T>) {
  if (swipe.consumeClick(row.key)) return;
  if (swipe.isRevealed(row.key)) {
    swipe.hide(row.key);
    return;
  }
  emit('activate', row.item);
}

function onUnderTap(row: RowView<T>) {
  if (swipe.consumeClick(row.key)) return;
  swipe.hide(row.key);
  const opt = row.opts[0];
  if (opt) emit('select', row.item, opt);
}

function onMoreTap(row: RowView<T>) {
  if (swipe.consumeClick(row.key)) return;
  swipe.hide(row.key);
  dialogItem.value = row.item;
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
  swipe.dropMissing(new Set(views.map((v) => v.key)));
  if (ctxItem.value !== null && !props.items.includes(ctxItem.value)) ctxItem.value = null;
  if (dialogItem.value !== null && !props.items.includes(dialogItem.value)) dialogItem.value = null;
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
  <div ref="listEl" class="sf-sm" v-bind="$attrs">
    <div v-for="row in rowViews" :key="row.key" class="sf-sm-row">
      <div
        v-if="row.opts.length > 0"
        class="sf-sm-under"
        :class="{
          'sf-sm-under--revealed': isRevealed(row.key),
          'sf-sm-under--active': isUnderVisible(row.key),
          'sf-sm-under--armed': isArmed(row.key),
        }"
        :style="underStyleOf(row.key)"
        @pointerdown="onDown($event, row)"
        @pointermove="swipe.move($event, row.key)"
        @pointerup="onUp($event, row)"
        @pointercancel="swipe.cancel(row.key, $event)"
        @touchmove="swipe.touchMove($event, row.key)"
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
        <button
          v-else
          class="sf-sm-act sf-sm-act--more"
          title="More"
          @click.stop="onMoreTap(row)"
        >
          <SvgIcon name="⋯" />
          <span>More</span>
        </button>
      </div>
      <div
        class="sf-sm-slide"
        :class="{ 'sf-sm-slide--swiping': isSwiping(row.key), 'sf-sm-slide--armed': isArmed(row.key) }"
        :style="slideStyle(row.key)"
        :draggable="draggable"
        @pointerdown="onDown($event, row)"
        @pointermove="swipe.move($event, row.key)"
        @pointerup="onUp($event, row)"
        @pointercancel="swipe.cancel(row.key, $event)"
        @touchmove="swipe.touchMove($event, row.key)"
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
