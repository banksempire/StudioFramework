<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import { getTabContent } from '../registry';
import type { TileNode } from '../workspace/tree';
import { kWorkspace, kRightPanelToggle } from '../composables/useWorkspace';

const props = defineProps<{ tile: TileNode }>();
const ws = inject(kWorkspace)!;
const rpToggle = inject(kRightPanelToggle, null);

const el = ref<HTMLElement | null>(null);
onMounted(() => ws.registerTileEl(props.tile.id, el.value));
onBeforeUnmount(() => ws.registerTileEl(props.tile.id, null));

const activeTab = computed(() => (props.tile.activeId ? ws.tabDefs[props.tile.activeId] ?? null : null));
const contentComp = computed(() => {
  const content = activeTab.value?.content;
  return content ? getTabContent(content) ?? null : null;
});
/** Registered component for the layout's emptyContent key (if any). */
const emptyComp = computed(() => (ws.emptyContent ? getTabContent(ws.emptyContent) ?? null : null));
const focused = computed(() => ws.focusedTileId === props.tile.id);
const isTopRight = computed(() => ws.topRightTileId === props.tile.id);
const canEvenlySpace = computed(() => ws.roots.length > 1);
const evenlySpaceTitle = computed(() =>
  ws.rootDir === 'column' ? 'Evenly space rows' : 'Evenly space columns',
);

function onTabDragStart(e: DragEvent, tabId: string) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  }
  ws.startDrag(tabId, props.tile.id, props.tile.tabs.indexOf(tabId));
}

/** Clicking a tab notifies host apps (review/preview semantics) and
 *  activates it. The notification fires only for REAL clicks — programmatic
 *  activation via ops.activateTab is silent. */
function onTabClick(tabId: string) {
  ws.notifyTabClick(tabId);
  ws.ops.activateTab(props.tile.id, tabId);
}

/** Middle-click a tab to close it (VSCode behavior). Closes on mousedown so
 *  the tab is gone before the click event would activate it. */
function onTabMousedown(e: MouseEvent, tabId: string) {
  if (e.button !== 1) return;
  e.preventDefault();  // suppress middle-click autoscroll
  if (ws.tabDefs[tabId]?.closeable === false) return;
  ws.ops.closeTab(tabId);
}
</script>

<template>
  <div ref="el" class="sf-tile" :class="{ 'sf-tile--focused': focused }" :data-tile="tile.id" @mousedown="ws.ops.focusTile(tile.id)">
    <!-- Tab strip -->
    <div class="sf-tile-tabs">
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
        draggable="true"
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
      <button class="sf-tab-new" :title="ws.newTabTitle" @click="ws.ops.newTab(tile.id)">+</button>
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
  border-radius: 3px;
  padding: 1px 5px;
}

/* Custom content fills the whole tile body; it manages its own layout/scroll */
.sf-tile-custom {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
