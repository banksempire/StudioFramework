<script setup lang="ts" generic="T">
import { computed, inject, nextTick, onMounted, onUnmounted, type Ref, ref, watch } from 'vue';
import { kIsMobile } from '../composables/useWorkspace';
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

const injectedMobile = inject(kIsMobile, null);
const isMobile = computed(() => injectedMobile?.value ?? false);

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

const dialogItem = ref(null) as Ref<T | null>;
const dialogTitle = computed(() => {
  const item = dialogItem.value;
  return item !== null && props.titleOf ? String(props.titleOf(item) ?? '') : '';
});

function onMore(row: RowView<T>) {
  dialogItem.value = row.item;
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

watch(rowViews, () => {
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
          <slot name="item" :item="row.item" :index="row.index" />
        </div>
        <button
          v-if="isMobile && row.opts.length > 0"
          class="sf-sm-more"
          title="More"
          aria-label="More actions"
          @click.stop="onMore(row)"
        >
          <SvgIcon name="⋮" />
        </button>
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
