<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { kIsMobile, kMobilePanelDismiss } from '../composables/useWorkspace';
import type {
  PanelListAdd,
  PanelListBulk,
  PanelListButton,
  PanelListItem,
  PanelListLine,
  PanelListOption,
} from '../types/panel';
import Icon from './Icon.vue';
import SingleMenu from './SingleMenu.vue';
import SvgIcon from './SvgIcon.vue';
import SwitchToggle from './SwitchToggle.vue';

const props = defineProps<{
  items: PanelListItem[];
  empty?: string;
  variant?: 'plain' | 'card';
  dismissOnActivate?: boolean;
  bulk?: PanelListBulk;
  searchable?: boolean;
  searchPlaceholder?: string;
  footer?: PanelListButton;
  add?: PanelListAdd;
  draggable?: boolean;
}>();

const emit = defineEmits<{
  activate: [item: PanelListItem];
  menu: [item: PanelListItem, optionId: string];
  button: [
    item: PanelListItem,
    buttonId: string,
    click: { x: number; y: number; openMenu: (x: number, y: number) => void },
  ];
  'switch-toggle': [item: PanelListItem];
  footer: [buttonId: string];
  add: [optionId: string | undefined];
  dragstart: [item: PanelListItem, event: DragEvent];
  dragend: [event: DragEvent];
  'bulk-action': [actionId: string];
  'bulk-change': [selected: string[]];
  'bulk-reorder': [fromId: string, toId: string];
}>();

const dismissMobilePanel = inject<(() => void) | null>(kMobilePanelDismiss, null);

const rich = computed(
  () =>
    props.variant === 'card' ||
    props.add !== undefined ||
    props.items.some(
      (it) =>
        it.lines !== undefined ||
        it.meta !== undefined ||
        it.detail !== undefined ||
        it.note !== undefined ||
        it.dot !== undefined ||
        it.iconBlink === true ||
        it.switch !== undefined ||
        it.active === true ||
        it.muted === true ||
        (it.buttons?.length ?? 0) > 0 ||
        (it.options?.length ?? 0) > 0,
    ),
);

const hasDrag = computed(() => props.draggable === true && props.items.some((it) => it.dragType));

const query = ref('');

const visibleItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.items;
  return props.items.filter((it) =>
    [it.label, it.meta, it.detail, it.search].some((v) => v?.toLowerCase().includes(q)),
  );
});

const noMatch = computed(() => query.value.trim() !== '' && visibleItems.value.length === 0);

function onActivate(item: PanelListItem) {
  if (item.action) {
    emit('activate', item);
    if (props.dismissOnActivate) dismissMobilePanel?.();
  }
}

function onDragStart(item: PanelListItem, e: DragEvent) {
  const type = item.dragType;
  if (!type) {
    e.preventDefault();
    return;
  }
  const dt = e.dataTransfer;
  if (!dt) return;
  dt.setData(type, item.dragData ?? item.id);
  if (item.dragText) dt.setData('text/plain', item.dragText);
  dt.effectAllowed = 'copy';
  emit('dragstart', item, e);
}

const bulkActive = computed(() => props.bulk?.active === true);
const injectedMobile = inject(kIsMobile, null);
const isMobile = computed(() => injectedMobile?.value ?? false);

function visibleButtons(it: PanelListItem): PanelListButton[] {
  return (it.buttons ?? []).filter((b) => {
    const v = b.visibility ?? 'always';
    if (v === 'mobile') return isMobile.value;
    if (v === 'desktop') return !isMobile.value;
    if (v === 'edit') return bulkActive.value;
    return true;
  });
}

function lineClass(line: PanelListLine) {
  return {
    'sf-pl-line--muted': line.muted === true,
    'sf-pl-line--trunc-meta': line.truncate === 'meta',
  };
}
const lastToggle = ref<{ index: number; state: boolean }>({ index: -1, state: false });

watch(
  () => props.bulk?.active,
  (on) => {
    lastToggle.value = { index: -1, state: false };
    if (!on) {
      dragId.value = null;
      overId.value = null;
    }
  },
);

function onRowClick(item: PanelListItem, e: MouseEvent) {
  if (!bulkActive.value) return;
  e.stopPropagation();
  e.preventDefault();
  const ids = props.items.map((i) => i.id);
  const idx = ids.indexOf(item.id);
  if (idx < 0) return;
  const picked = new Set(props.bulk?.selected ?? []);
  if (e.shiftKey && lastToggle.value.index >= 0) {
    const lo = Math.min(lastToggle.value.index, idx);
    const hi = Math.max(lastToggle.value.index, idx);
    for (let i = lo; i <= hi; i++) {
      if (lastToggle.value.state) picked.add(ids[i]);
      else picked.delete(ids[i]);
    }
  } else {
    const state = !picked.has(item.id);
    if (state) picked.add(item.id);
    else picked.delete(item.id);
    lastToggle.value = { index: idx, state };
  }
  emit(
    'bulk-change',
    props.items.filter((i) => picked.has(i.id)).map((i) => i.id),
  );
}

const dragId = ref<string | null>(null);
const overId = ref<string | null>(null);

function onGripStart(item: PanelListItem, e: DragEvent) {
  dragId.value = item.id;
  e.dataTransfer?.setData('text/plain', item.id);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onGripEnd() {
  dragId.value = null;
  overId.value = null;
}

function onRowDrop(item: PanelListItem) {
  const from = dragId.value;
  dragId.value = null;
  overId.value = null;
  if (from && from !== item.id) emit('bulk-reorder', from, item.id);
}

let touchDrag: { id: string; pointerId: number; el: HTMLElement } | null = null;

function touchRowAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.sf-pl-item[data-id]');
  return el?.dataset.id ?? null;
}

function onTouchDragMove(e: PointerEvent) {
  if (!touchDrag) return;
  const id = touchRowAt(e.clientX, e.clientY);
  overId.value = id;
  const scroller = touchDrag.el.closest<HTMLElement>('.sf-pl, .sf-pc-list');
  if (scroller) {
    const r = scroller.getBoundingClientRect();
    if (e.clientY < r.top + 48) scroller.scrollTop -= 12;
    else if (e.clientY > r.bottom - 48) scroller.scrollTop += 12;
  }
}

function onTouchDragEnd(e: PointerEvent) {
  if (!touchDrag) return;
  const { id, pointerId, el } = touchDrag;
  touchDrag = null;
  window.removeEventListener('pointermove', onTouchDragMove);
  window.removeEventListener('pointerup', onTouchDragEnd);
  window.removeEventListener('pointercancel', onTouchDragEnd);
  try {
    el.releasePointerCapture(pointerId);
  } catch {
    touchDrag = null;
  }
  const to = touchRowAt(e.clientX, e.clientY) ?? overId.value;
  dragId.value = null;
  overId.value = null;
  if (to && to !== id) emit('bulk-reorder', id, to);
}

function onGripPointerDown(item: PanelListItem, e: PointerEvent) {
  if (e.pointerType !== 'touch' || props.draggable !== true || !item.dragType) return;
  const el = e.currentTarget as HTMLElement;
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    touchDrag = { id: item.id, pointerId: -1, el: document.body };
    window.addEventListener('pointermove', onTouchDragMove);
    window.addEventListener('pointerup', onTouchDragEnd);
    window.addEventListener('pointercancel', onTouchDragEnd);
    dragId.value = item.id;
    overId.value = item.id;
    return;
  }
  touchDrag = { id: item.id, pointerId: e.pointerId, el };
  dragId.value = item.id;
  overId.value = item.id;
  window.addEventListener('pointermove', onTouchDragMove);
  window.addEventListener('pointerup', onTouchDragEnd);
  window.addEventListener('pointercancel', onTouchDragEnd);
}

function onButtonClick(
  it: PanelListItem,
  b: PanelListButton,
  e: MouseEvent,
  openMenu: (x: number, y: number) => void,
) {
  emit('button', it, b.id, { x: e.clientX, y: e.clientY, openMenu });
}

const showEmpty = computed(() => props.items.length === 0 && !!props.empty && !props.bulk);

const addOpen = ref(false);
const addX = ref(0);
const addY = ref(0);
const addMenuEl = ref<HTMLElement | null>(null);
const addMenuStyle = ref<{ left: string; top: string }>({ left: '0px', top: '0px' });
let addToggleGuard = false;

function onAddClick(e: MouseEvent) {
  if (addToggleGuard) {
    addToggleGuard = false;
    return;
  }
  const opts = props.add?.options ?? [];
  if (opts.length === 0) {
    emit('add', undefined);
    return;
  }
  addX.value = e.clientX;
  addY.value = e.clientY;
  addOpen.value = true;
}

function pickAdd(opt: PanelListOption) {
  if (opt.disabled) return;
  addOpen.value = false;
  emit('add', opt.id);
}

watch(addOpen, async (v) => {
  if (!v) return;
  await nextTick();
  const el = addMenuEl.value;
  if (!el) return;
  const w = el.offsetWidth || 200;
  const h = el.offsetHeight || 80;
  addMenuStyle.value = {
    left: `${Math.max(4, Math.min(addX.value, window.innerWidth - w - 4))}px`,
    top: `${Math.max(4, Math.min(addY.value, window.innerHeight - h - 4))}px`,
  };
});

function onAddDocDown(e: MouseEvent) {
  addToggleGuard = false;
  if (!addOpen.value) return;
  if (addMenuEl.value?.contains(e.target as Node)) return;
  if ((e.target as Element | null)?.closest?.('.sf-pl-item--add')) addToggleGuard = true;
  addOpen.value = false;
}

function onAddDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape') addOpen.value = false;
}

const addSheetTarget = ref<HTMLElement | 'body'>('body');

const addRow = ref<HTMLElement | null>(null);
const addMinHeight = ref<number | null>(null);

function measureAddHeight() {
  const row = addRow.value;
  if (!row) {
    addMinHeight.value = null;
    return;
  }
  const last = row.parentElement?.querySelector<HTMLElement>('.sf-pl-item:not(.sf-pl-item--add)');
  addMinHeight.value = last ? last.getBoundingClientRect().height : null;
}

watch(
  () => [props.items, props.add] as const,
  () => measureAddHeight(),
  { flush: 'post', immediate: true },
);

if (typeof window !== 'undefined') {
  onMounted(() => {
    addSheetTarget.value = (document.querySelector('.sf-root') as HTMLElement | null) ?? 'body';
    window.addEventListener('mousedown', onAddDocDown);
    window.addEventListener('keydown', onAddDocKey);
  });
  onUnmounted(() => {
    window.removeEventListener('mousedown', onAddDocDown);
    window.removeEventListener('keydown', onAddDocKey);
  });
}
</script>

<template>
  <div v-if="showEmpty" class="sf-empty">{{ props.empty }}</div>
  <div v-if="!rich && (!showEmpty || props.add)" class="sf-pc-list">
    <div v-if="props.searchable" class="sf-pl-search">
      <input
        v-model="query"
        class="sf-pl-search-input"
        type="text"
        :placeholder="props.searchPlaceholder ?? 'Search…'"
        @keydown.esc="query = ''"
      />
    </div>
    <div v-if="noMatch" class="sf-empty">No match</div>
    <div
      v-for="item in visibleItems"
      :key="item.id"
      class="sf-pc-list-item"
      :data-id="item.id"
      @click="emit('activate', item)"
    >
      <Icon v-if="item.icon" class="sf-pc-list-icon" :icon="item.icon" />
      <span class="sf-pc-list-label">{{ item.label }}</span>
      <span v-if="item.badge" class="sf-pc-list-badge">{{ item.badge }}</span>
    </div>
  </div>
  <div v-else-if="!showEmpty || props.add" class="sf-pl" :class="'sf-pl--' + (props.variant ?? 'plain')">
    <div v-if="props.searchable" class="sf-pl-search">
      <input
        v-model="query"
        class="sf-pl-search-input"
        type="text"
        :placeholder="props.searchPlaceholder ?? 'Search…'"
        @keydown.esc="query = ''"
      />
    </div>
    <div v-if="noMatch" class="sf-empty">No match</div>
    <SingleMenu v-else
      :items="visibleItems"
      :options="(it: PanelListItem) => (bulkActive ? [] : it.options ?? [])"
      :key-of="(it: PanelListItem) => it.id"
      :title-of="(it: PanelListItem) => it.label"
      :draggable="hasDrag"
      @activate="onActivate"
      @select="(it: PanelListItem, opt) => emit('menu', it, opt.id)"
      @dragstart="onDragStart"
      @dragend="(e: DragEvent) => emit('dragend', e)"
    >
      <template #item="{ item: it, openMenu }">
        <div
          class="sf-pl-item"
          :class="{
            'sf-pl-item--active': it.active,
            'sf-pl-item--muted': it.muted,
            'sf-pl-item--trunc-meta': it.truncate === 'meta',
            'sf-pl-item--bulk': bulkActive,
            'sf-pl-item--drop': dragId !== null && overId === it.id,
          }"
          :data-id="it.id"
          :title="it.title"
          @click.capture="onRowClick(it, $event)"
          @dragover.prevent="dragId !== null && (overId = it.id)"
          @drop.prevent="onRowDrop(it)"
        >
          <span
            v-if="bulkActive"
            class="sf-pl-check"
            :class="{ 'sf-pl-check--on': props.bulk?.selected.includes(it.id) }"
          />

          <span
            v-if="bulkActive || (props.draggable === true && it.dragType)"
            class="sf-pl-grip"
            draggable="true"
            title="Drag to reorder"
            @dragstart.stop="onGripStart(it, $event)"
            @dragend="onGripEnd"
            @pointerdown="onGripPointerDown(it, $event)"
          >
            <SvgIcon name="grip" />
          </span>
          <div class="sf-pl-main">
            <div class="sf-pl-col">
              <div class="sf-pl-top">
                <SwitchToggle
                  v-if="it.switch"
                  :on="it.switch.on"
                  :title="it.switch.title"
                  @toggle="emit('switch-toggle', it)"
                />
                <span v-if="it.icon" class="sf-pl-icon" :class="{ 'sf-pl-icon--blink': it.iconBlink }">
                  <Icon :icon="it.icon" />
                </span>
                <span v-else-if="it.dot" class="sf-pl-dot" :class="'sf-pl-dot--' + it.dot" />
              <span class="sf-pl-label">{{ it.label }}</span>
              <span v-if="it.meta" class="sf-pl-meta">{{ it.meta }}</span>
              <span
                v-if="it.badge && !it.detail"
                class="sf-pl-badge"
                :class="'sf-pl-badge--' + (it.badgeTone ?? 'muted')"
              >
                {{ it.badge }}
              </span>
            </div>
            <div v-if="it.detail" class="sf-pl-sub">
              <span v-if="it.badge" class="sf-pl-badge" :class="'sf-pl-badge--' + (it.badgeTone ?? 'muted')">
                {{ it.badge }}
              </span>
              <span class="sf-pl-detail">{{ it.detail }}</span>
              <span v-if="it.detailMeta" class="sf-pl-detail-meta">{{ it.detailMeta }}</span>
            </div>
            <div v-if="it.lines?.length" class="sf-pl-lines">
              <div v-for="(ln, i) in it.lines" :key="i" class="sf-pl-line" :class="lineClass(ln)">
                <span class="sf-pl-line-text">{{ ln.text }}</span>
                <span v-if="ln.meta" class="sf-pl-line-meta">{{ ln.meta }}</span>
              </div>
            </div>
            <div v-if="it.note" class="sf-pl-note">{{ it.note }}</div>
            </div>
            <span v-if="visibleButtons(it).length > 0" class="sf-pl-btn-group">
              <button
                v-for="b in visibleButtons(it)"
                :key="b.id"
                class="sf-pl-btn"
                :class="{ 'sf-pl-btn--danger': b.danger, 'sf-pl-btn--icon': b.icon && !b.label }"
                type="button"
                :title="b.title ?? b.label ?? b.id"
                :disabled="b.disabled"
                @click.stop="onButtonClick(it, b, $event, openMenu)"
              >
                <Icon v-if="b.icon" :icon="b.icon" />
                <template v-else>{{ b.label }}</template>
              </button>
            </span>
          </div>

        </div>
      </template>
    </SingleMenu>
    <div
      v-if="props.add"
      ref="addRow"
      class="sf-pl-item sf-pl-item--add"
      :style="addMinHeight !== null ? { minHeight: `${addMinHeight}px` } : undefined"
      title="Add"
      @click="onAddClick"
    >
      <span class="sf-pl-add-sign"><SvgIcon name="➕" /></span>
    </div>
  </div>
  <Teleport :to="addSheetTarget">
    <div v-if="addOpen" ref="addMenuEl" class="sf-sm-menu" :style="addMenuStyle" role="menu">
      <button
        v-for="opt in props.add?.options ?? []"
        :key="opt.id"
        class="sf-sm-menu-row"
        :class="{
          'sf-sm-menu-row--danger': opt.danger,
          'sf-sm-menu-row--disabled': opt.disabled,
        }"
        role="menuitem"
        :disabled="opt.disabled"
        @click="pickAdd(opt)"
      >
        <Icon :icon="opt.icon" />
        <span>{{ opt.label ?? opt.id }}</span>
      </button>
    </div>
  </Teleport>
  <div v-if="props.footer" class="sf-pl-footer">
    <button
      class="sf-pl-footer-btn"
      type="button"
      :title="props.footer.title ?? props.footer.label ?? props.footer.id"
      :disabled="props.footer.disabled"
      @click="emit('footer', props.footer.id)"
    >
      <Icon v-if="props.footer.icon" :icon="props.footer.icon" />
      <template v-else>{{ props.footer.label }}</template>
    </button>
  </div>
</template>
