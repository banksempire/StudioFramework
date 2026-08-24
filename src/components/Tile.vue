<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { kRightPanelToggle, kTitleBarMenus, useWorkspaceContext } from '../composables/useWorkspace';
import { getTabContent } from '../registry';
import type { MenuNodeDef } from '../types/layout';
import type { TileNode } from '../workspace/tree';
import BlankTab from './BlankTab.vue';
import Icon from './Icon.vue';
import Menu from './Menu.vue';
import SvgIcon from './SvgIcon.vue';
import TabDropdown from './TabDropdown.vue';

const props = defineProps<{ tile: TileNode }>();
const ws = useWorkspaceContext();
const rpToggle = inject(kRightPanelToggle, null);
const titleBarMenus = inject(kTitleBarMenus, null);
const menuOpen = ref(false);

function onMobileMenuSelect(item: MenuNodeDef) {
  menuOpen.value = false;
  if (item.action && titleBarMenus) titleBarMenus.onAction(item.action);
}

const el = ref<HTMLElement | null>(null);

const synthetic = computed(() => ws.findTileGlobal(props.tile.id) === null);

function resolveTileId(tabId?: string): string {
  if (!synthetic.value) return props.tile.id;
  const byTab = tabId ? ws.findTabGlobal(tabId) : null;
  const focused = ws.findTileGlobal(ws.focusedTileId);
  return (byTab ?? focused ?? ws.findTileGlobal(ws.topRightTileId))?.id ?? props.tile.id;
}

onMounted(() => {
  if (synthetic.value) return;
  ws.registerTileEl(props.tile.id, el.value);
  scrollActiveTabIntoView();
});
onBeforeUnmount(() => {
  cancelLabelHold();
  if (synthetic.value) return;
  ws.registerTileEl(props.tile.id, null);
});

const activeTab = computed(() => (props.tile.activeId ? (ws.tabDefs[props.tile.activeId] ?? null) : null));

const tabMenuOpen = ref(false);
const tabsInnerEl = ref<HTMLElement | null>(null);

const LONG_PRESS_MS = 500;
const labelHold = ref(false);
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdStart = { x: 0, y: 0 };
let holdFired = false;

function cancelLabelHold() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
  labelHold.value = false;
}

function onLabelPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  holdStart = { x: e.clientX, y: e.clientY };
  holdFired = false;
  labelHold.value = true;
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {}
  holdTimer = setTimeout(() => {
    holdTimer = null;
    holdFired = true;
    labelHold.value = false;
    if (props.tile.activeId) ws.notifyTabLongPress(props.tile.activeId);
    navigator.vibrate?.(12);
  }, LONG_PRESS_MS);
}

function onLabelPointerMove(e: PointerEvent) {
  if (!holdTimer) return;
  const dx = e.clientX - holdStart.x;
  const dy = e.clientY - holdStart.y;
  if (dx * dx + dy * dy > 100) cancelLabelHold();
}

function onLabelClick(e: MouseEvent) {
  if (holdFired) {
    holdFired = false;
    e.preventDefault();
    return;
  }
  tabMenuOpen.value = !tabMenuOpen.value;
}

async function scrollActiveTabIntoView() {
  const id = props.tile.activeId;
  if (!id) return;
  await nextTick();
  const tab = tabsInnerEl.value?.querySelector(`[data-tab-id="${CSS.escape(id)}"]`);
  tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

watch(() => props.tile.activeId, scrollActiveTabIntoView);
const activeTabLabel = computed(() => activeTab.value?.label ?? '');
const tabList = computed(() =>
  props.tile.tabs.map((id) => ({
    id,
    label: ws.tabDefs[id]?.label ?? id,
    icon: ws.tabDefs[id]?.icon,
    closeable: ws.tabDefs[id]?.closeable !== false,
  })),
);

watch(
  tabList,
  (items) => {
    if (items.length === 0) tabMenuOpen.value = false;
  },
  { flush: 'post' },
);

const contentComp = computed(() => {
  const content = activeTab.value?.content;
  if (!content) return null;
  if (content === 'sf-blank') return BlankTab;
  return getTabContent(content) ?? null;
});
const emptyComp = computed(() => (ws.emptyContent ? (getTabContent(ws.emptyContent) ?? null) : null));
const focused = computed(() => ws.focusedTileId === props.tile.id);
const isTopRight = computed(() => ws.topRightTileId === props.tile.id);
const canEvenlySpace = computed(() => ws.roots.length > 1);
const evenlySpaceTitle = computed(() =>
  ws.rootDir === 'column' ? 'Evenly space rows' : 'Evenly space columns',
);

function onTabDragStart(e: DragEvent, tabId: string) {
  if (synthetic.value) return;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  }
  ws.startDrag(tabId, props.tile.id, props.tile.tabs.indexOf(tabId));
}

function onTabClick(tabId: string) {
  ws.notifyTabClick(tabId);
  ws.ops.activateTab(resolveTileId(tabId), tabId);
}

function onTabMousedown(e: MouseEvent, tabId: string) {
  if (e.button !== 1) return;
  e.preventDefault();
  if (ws.tabDefs[tabId]?.closeable === false) return;
  ws.ops.closeTab(tabId);
}

function onTileMousedown() {
  if (synthetic.value) return;
  ws.ops.focusTile(props.tile.id);
}
</script>

<template>
  <div ref="el" class="sf-tile" :class="{ 'sf-tile--focused': focused }" :data-tile="tile.id" @mousedown="onTileMousedown">
    <div class="sf-tile-tabs" :class="{ 'sf-mobile-tab-bar--holding': labelHold }">
      <template v-if="synthetic">
        <Menu
          v-if="titleBarMenus"
          :items="titleBarMenus.menus"
          :open="menuOpen"
          @update:open="(v) => (menuOpen = v)"
          @select="onMobileMenuSelect"
        >
          <template #trigger="{ toggle }">
            <button
              class="sf-mobile-menu-btn"
              title="Menu"
              @click.stop="toggle"
            ><SvgIcon name="⋯" /></button>
          </template>
        </Menu>
        <TabDropdown
          :open="tabMenuOpen"
          :items="tabList"
          :active-id="props.tile.activeId"
          @update:open="(v) => (tabMenuOpen = v)"
          @select="onTabClick"
          @close="ws.ops.closeTab"
        />
        <span
          class="sf-mobile-tab-label"
          :class="activeTab?.tabClass"
          @pointerdown="onLabelPointerDown"
          @pointermove="onLabelPointerMove"
          @pointerup="cancelLabelHold"
          @pointercancel="cancelLabelHold"
          @contextmenu.prevent
          @click.stop="onLabelClick"
        >
          <span class="sf-mobile-tab-icon-slot">
            <Icon v-if="activeTab?.icon" class="sf-mobile-tab-icon" :icon="activeTab.icon" />
          </span>
          <span class="sf-mobile-tab-text">{{ activeTabLabel || 'No tab open' }}</span>
        </span>
        <div v-if="rpToggle" class="sf-mobile-rp-wrap">
          <button
            class="sf-mobile-rp-btn"
            :class="{ active: rpToggle.visible }"
            :title="rpToggle.visible ? 'Collapse Right Panel' : 'Expand Right Panel'"
            @click="rpToggle.toggle()"
          >
            <svg class="sf-mobile-rp-icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" />
              <rect v-if="rpToggle.visible" x="1" y="1" width="7" height="14" fill="currentColor" />
              <rect v-else x="8" y="1" width="7" height="14" fill="currentColor" />
            </svg>
          </button>
        </div>
      </template>
      <template v-else>
        <div ref="tabsInnerEl" class="sf-tile-tabs-inner">
        <div
          v-for="tabId in tile.tabs"
          :key="tabId"
          class="sf-tab"
          :data-tab-id="tabId"
          :class="[
            ws.tabDefs[tabId]?.tabClass,
            {
              active: tabId === tile.activeId,
              dragging: ws.dnd.dragging && ws.dnd.tabId === tabId,
            },
          ]"
          :draggable="!synthetic"
          @click="onTabClick(tabId)"
          @mousedown="onTabMousedown($event, tabId)"
          @dragstart="onTabDragStart($event, tabId)"
          @dragend="ws.endDrag"
        >
          <span class="sf-tab-icon-slot">
            <Icon v-if="ws.tabDefs[tabId]?.icon" class="sf-tab-icon" :icon="ws.tabDefs[tabId].icon" />
          </span>
          <span class="sf-tab-label">{{ ws.tabDefs[tabId]?.label ?? tabId }}</span>
          <span
            v-if="ws.tabDefs[tabId]?.closeable !== false"
            class="sf-tab-close"
            @click.stop="ws.ops.closeTab(tabId)"
          ><SvgIcon name="✕" /></span>
        </div>
        </div>
        <template v-if="isTopRight">
          <div v-if="canEvenlySpace" class="sf-btn-group">
            <button
              class="sf-tab-panel-toggle"
              title="Merge all tiles into one"
              @click="ws.ops.mergeAll()"
            ><SvgIcon name="□" /></button>
            <button
              class="sf-tab-panel-toggle"
              :title="evenlySpaceTitle"
              @click="ws.ops.evenlySpace()"
            ><SvgIcon name="⇔" /></button>
          </div>
          <div v-if="rpToggle" class="sf-btn-group">
            <button
              class="sf-tab-panel-toggle"
              :title="rpToggle.visible ? 'Collapse Right Panel' : 'Expand Right Panel'"
              @click="rpToggle.toggle()"
            ><SvgIcon :name="rpToggle.visible ? '\u25E8' : '\u25EB'" /></button>
          </div>
        </template>
      </template>
    </div>

    <div class="sf-tile-content">
      <div v-if="!activeTab" class="sf-tile-empty">
        <component v-if="emptyComp" :is="emptyComp" />
        <div v-else class="sf-tile-empty-inner">
          <p>No tab open</p>
          <p class="sf-tile-empty-hint">Drag a tab here, or press <kbd>+</kbd></p>
        </div>
      </div>
      <div v-else-if="contentComp" class="sf-tile-custom">
        <component :is="contentComp" v-bind="activeTab.props ?? {}" />
      </div>
      <div v-else class="sf-tile-placeholder">
        <div class="sf-tile-lines">
          <div v-for="n in 12" :key="n" class="sf-tile-line">
            <span class="sf-line-number">{{ n }}</span>
            <span class="sf-line-text">{{ n === 1 ? '// ' + activeTab.label : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sf-tile {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--sf-bg);
}

.sf-tile-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sf-text-muted);
  font-size: 16px;
}

.sf-tile-empty-inner {
  text-align: center;
}

.sf-tile-empty p {
  margin: 4px 0;
}

.sf-tile-empty-hint {
  font-size: 16px;
}

.sf-tile-empty kbd {
  font-family: var(--sf-mono);
  font-size: 16px;
  background: var(--sf-bg-light);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  padding: 1px 5px;
}

.sf-tab--ghost .sf-tab-label {
  font-style: italic;
  opacity: 0.6;
}

.sf-tile-custom {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
