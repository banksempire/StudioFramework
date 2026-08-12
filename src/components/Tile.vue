<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { kRightPanelToggle, useWorkspaceContext } from '../composables/useWorkspace';
import { getTabContent } from '../registry';
import type { MenuNodeDef } from '../types/layout';
import type { TileNode } from '../workspace/tree';
import BlankTab from './BlankTab.vue';
import Icon from './Icon.vue';
import Menu from './Menu.vue';

const props = defineProps<{ tile: TileNode }>();
const ws = useWorkspaceContext();
const rpToggle = inject(kRightPanelToggle, null);

const el = ref<HTMLElement | null>(null);

/** True for the synthetic mobile flat tile (see Workspace.vue): a view over
 *  the real tree whose id is not backed by a real tile. Actions route to
 *  the real tile holding the tab; DnD is disabled (no drag-to-tile on
 *  mobile) and the element never registers as a drop target. */
const synthetic = computed(() => ws.findTileGlobal(props.tile.id) === null);

/** Resolve the real tile behind an action on the synthetic flat tile. */
function resolveTileId(tabId?: string): string {
  if (!synthetic.value) return props.tile.id;
  const byTab = tabId ? ws.findTabGlobal(tabId) : null;
  const focused = ws.findTileGlobal(ws.focusedTileId);
  return (byTab ?? focused ?? ws.findTileGlobal(ws.topRightTileId))?.id ?? props.tile.id;
}

onMounted(() => {
  if (synthetic.value) return;
  ws.registerTileEl(props.tile.id, el.value);
});
onBeforeUnmount(() => {
  if (synthetic.value) return;
  ws.registerTileEl(props.tile.id, null);
});

const activeTab = computed(() => (props.tile.activeId ? (ws.tabDefs[props.tile.activeId] ?? null) : null));

// ── Mobile compact bar (synthetic flat tile only) ─────────────────────────
// The mobile title bar is NOT a tab strip: [tab selector | active tab |
// close | right-panel expand]. The selector lists every tab (visual
// order); selecting routes to the real tile behind the tab. The close
// button closes the ACTIVE tab; the right-panel button toggles the right
// panel fullscreen (rpToggle, provided by Workspace.vue).

const tabMenuOpen = ref(false);
const activeTabLabel = computed(() => activeTab.value?.label ?? '');
const activeTabCloseable = computed(() => {
  const id = props.tile.activeId;
  return !!id && ws.tabDefs[id]?.closeable !== false;
});
const tabSelectorItems = computed<MenuNodeDef[]>(() =>
  props.tile.tabs.map((id) => ({
    id,
    label: ws.tabDefs[id]?.label ?? id,
    icon: ws.tabDefs[id]?.icon,
    selected: id === props.tile.activeId,
  })),
);

function onTabSelectorSelect(item: MenuNodeDef) {
  if (!item.id) return;
  onTabClick(item.id);
}

function onCloseActive() {
  const id = props.tile.activeId;
  if (!id) return;
  if (ws.tabDefs[id]?.closeable === false) return;
  ws.ops.closeTab(id);
}
const contentComp = computed(() => {
  const content = activeTab.value?.content;
  if (!content) return null;
  // Ghost tabs (missing windows restored from a workspace snapshot) render
  // the framework's built-in blank page — no host registration needed.
  if (content === 'sf-blank') return BlankTab;
  return getTabContent(content) ?? null;
});
/** Registered component for the layout's emptyContent key (if any). */
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

/** Clicking a tab notifies host apps (review/preview semantics) and
 *  activates it. The notification fires only for REAL clicks — programmatic
 *  activation via ops.activateTab is silent. On the synthetic flat tile the
 *  activation lands on the real tile behind the tab. */
function onTabClick(tabId: string) {
  ws.notifyTabClick(tabId);
  ws.ops.activateTab(resolveTileId(tabId), tabId);
}

/** Middle-click a tab to close it (VSCode behavior). Closes on mousedown so
 *  the tab is gone before the click event would activate it. */
function onTabMousedown(e: MouseEvent, tabId: string) {
  if (e.button !== 1) return;
  e.preventDefault(); // suppress middle-click autoscroll
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
    <!-- Tab strip (desktop) / compact bar (mobile flat tile) -->
    <div class="sf-tile-tabs">
      <template v-if="synthetic">
        <!-- Mobile: [tab selector | active tab | close | right panel] -->
        <Menu
          :items="tabSelectorItems"
          :open="tabMenuOpen"
          @update:open="(v) => (tabMenuOpen = v)"
          @select="onTabSelectorSelect"
        >
          <template #trigger="{ toggle }">
            <button
              class="sf-mobile-tab-selector"
              title="Tabs"
              @click.stop="toggle"
            >☰</button>
          </template>
        </Menu>
        <span class="sf-mobile-tab-label">{{ activeTabLabel || 'No tab open' }}</span>
        <button
          class="sf-mobile-tab-close"
          title="Close tab"
          :disabled="!activeTabCloseable"
          @click="onCloseActive"
        >✕</button>
        <div v-if="rpToggle" class="sf-mobile-rp-wrap">
          <button
            class="sf-mobile-rp-btn"
            :class="{ active: rpToggle.visible }"
            :title="rpToggle.visible ? 'Collapse Right Panel' : 'Expand Right Panel'"
            @click="rpToggle.toggle()"
          >{{ rpToggle.visible ? '\u25E8' : '\u25EB' }}</button>
        </div>
      </template>
      <template v-else>
        <div
          v-for="tabId in tile.tabs"
          :key="tabId"
          class="sf-tab"
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
          <Icon v-if="ws.tabDefs[tabId]?.icon" class="sf-tab-icon" :icon="ws.tabDefs[tabId].icon" />
          <span class="sf-tab-label">{{ ws.tabDefs[tabId]?.label ?? tabId }}</span>
          <span
            v-if="ws.tabDefs[tabId]?.closeable !== false"
            class="sf-tab-close"
            @click.stop="ws.ops.closeTab(tabId)"
          >✕</span>
        </div>
        <button class="sf-tab-new" :title="ws.newTabTitle" @click="ws.ops.newTab(resolveTileId())">+</button>
        <template v-if="isTopRight">
          <div v-if="canEvenlySpace" class="sf-btn-group">
            <button
              class="sf-tab-panel-toggle"
              title="Merge all tiles into one"
              @click="ws.ops.mergeAll()"
            >□</button>
            <button
              class="sf-tab-panel-toggle"
              :title="evenlySpaceTitle"
              @click="ws.ops.evenlySpace()"
            >⇔</button>
          </div>
          <div v-if="rpToggle" class="sf-btn-group">
            <button
              class="sf-tab-panel-toggle"
              :title="rpToggle.visible ? 'Collapse Right Panel' : 'Expand Right Panel'"
              @click="rpToggle.toggle()"
            >{{ rpToggle.visible ? '\u25E8' : '\u25EB' }}</button>
          </div>
        </template>
      </template>
    </div>

    <!-- Content -->
    <div class="sf-tile-content">
      <div v-if="!activeTab" class="sf-tile-empty">
        <!-- Host-app empty content (e.g. a welcome page) when the layout
             declares emptyContent; generic hint otherwise. -->
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

/* Ghost tabs (workspace-snapshot windows whose content no longer exists)
   look dimmed/italic so they read as placeholders, not real windows. */
.sf-tab--ghost .sf-tab-label {
  font-style: italic;
  opacity: 0.6;
}

/* Custom content fills the whole tile body; it manages its own layout/scroll */
.sf-tile-custom {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
