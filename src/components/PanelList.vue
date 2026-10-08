<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { kIsMobile, kMobilePanelDismiss } from '../composables/useWorkspace';
import type { PanelListBulk, PanelListButton, PanelListItem, PanelListLine } from '../types/panel';
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
    props.items.some(
      (it) =>
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

function onButtonClick(
  it: PanelListItem,
  b: PanelListButton,
  e: MouseEvent,
  openMenu: (x: number, y: number) => void,
) {
  emit('button', it, b.id, { x: e.clientX, y: e.clientY, openMenu });
}
</script>

<template>
  <div v-if="props.items.length === 0 && props.empty && !props.bulk" class="sf-empty">{{ props.empty }}</div>
  <div v-else-if="!rich" class="sf-pc-list">
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
  <div v-else class="sf-pl" :class="'sf-pl--' + (props.variant ?? 'plain')">
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
  </div>
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
