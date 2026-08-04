<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import type { TileNode } from '../workspace/tree';
import { kWorkspace } from '../composables/useWorkspace';

const props = defineProps<{ tile: TileNode }>();
const ws = inject(kWorkspace)!;

const el = ref<HTMLElement | null>(null);
onMounted(() => ws.registerTileEl(props.tile.id, el.value));
onBeforeUnmount(() => ws.registerTileEl(props.tile.id, null));

const activeTab = computed(() => (props.tile.activeId ? ws.tabDefs[props.tile.activeId] ?? null : null));
const focused = computed(() => ws.focusedTileId === props.tile.id);

function onTabDragStart(e: DragEvent, tabId: string) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  }
  ws.startDrag(tabId, props.tile.id, props.tile.tabs.indexOf(tabId));
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
        :class="{
          active: tabId === tile.activeId,
          dragging: ws.dnd.dragging && ws.dnd.tabId === tabId,
        }"
        draggable="true"
        @click="ws.ops.activateTab(tile.id, tabId)"
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
      <button class="sf-tab-new" title="New file" @click="ws.ops.newTab(tile.id)">+</button>
    </div>

    <!-- Content -->
    <div class="sf-tile-content">
      <div v-if="!activeTab" class="sf-tile-empty">
        <div class="sf-tile-empty-inner">
          <p>No tab open</p>
          <p class="sf-tile-empty-hint">Drag a tab here, or press <kbd>+</kbd></p>
        </div>
      </div>
      <div v-else-if="activeTab.content === 'welcome'" class="sf-welcome">
        <div class="sf-welcome-content">
          <h1>Studio Framework</h1>
          <p>A VSCode-like UI framework built with Vue 3 + TypeScript</p>
          <div class="sf-welcome-shortcuts">
            <div class="sf-shortcut"><kbd>Ctrl+N</kbd> New File</div>
            <div class="sf-shortcut"><kbd>Ctrl+O</kbd> Open Folder</div>
            <div class="sf-shortcut"><kbd>Ctrl+S</kbd> Save</div>
            <div class="sf-shortcut"><kbd>Ctrl+P</kbd> Quick Open</div>
          </div>
        </div>
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
  border-radius: var(--sf-radius);
}

.sf-tile-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sf-text-muted);
  font-size: 14px;
}

.sf-tile-empty-inner {
  text-align: center;
}

.sf-tile-empty p {
  margin: 4px 0;
}

.sf-tile-empty-hint {
  font-size: 12px;
}

.sf-tile-empty kbd {
  font-family: var(--sf-mono);
  font-size: 11px;
  background: var(--sf-bg-light);
  border: 1px solid var(--sf-border);
  border-radius: 3px;
  padding: 1px 5px;
}
</style>
