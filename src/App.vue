<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { layout } from './layout/loadLayout';
import MenuBar from './components/MenuBar.vue';
import Docker from './components/Docker.vue';
import DockerPanel from './components/DockerPanel.vue';
import Workspace from './components/Workspace.vue';
import RightPanel from './components/RightPanel.vue';
import StatusBar from './components/StatusBar.vue';

const activeDockerTag = ref(layout.docker[0]?.id ?? '');
const leftPanelVisible = ref(true);
const dockerPanelVisible = ref(true);
const savedPanelState = ref(true);
const rightPanelVisible = ref(true);

// ── Auto-hide panels on narrow windows ────────────────────────────────────

/** Minimum workspace width (px) before panels start auto-hiding. */
const MIN_WORKSPACE_WIDTH = 200;
const leftAutoHidden = ref(false);
const rightAutoHidden = ref(false);

/** Last known panel widths (retained when panel is hidden, for restore checks). */
const leftPanelWidth = ref(260);
const rightPanelWidth = ref(260);

/** Suppress auto-hide briefly after a user override (toggle/docker click). */
let suppressCheck = false;
let suppressTimer: ReturnType<typeof setTimeout> | undefined;
function suppressAutoHide() {
  suppressCheck = true;
  clearTimeout(suppressTimer);
  suppressTimer = setTimeout(() => { suppressCheck = false; }, 100);
}

function updatePanelWidths() {
  const lEl = document.querySelector('.sf-panel--left') as HTMLElement | null;
  const rEl = document.querySelector('.sf-panel--right') as HTMLElement | null;
  if (lEl && lEl.offsetWidth > 0) leftPanelWidth.value = lEl.offsetWidth;
  if (rEl && rEl.offsetWidth > 0) rightPanelWidth.value = rEl.offsetWidth;
}

/**
 * Progressive auto-hide based on the workspace's actual width.
 * Collapse: wider panel first (right if tied), then the narrower.
 * Restore: narrower first (left if tied) — only if the workspace would
 * still be ≥ MIN_WORKSPACE_WIDTH after the panel takes its space back.
 */
function checkAutoHide() {
  if (suppressCheck) return;
  updatePanelWidths();

  const wsEl = document.querySelector('.sf-workspace') as HTMLElement | null;
  const wsWidth = wsEl?.clientWidth ?? 0;
  const hasRight = !!layout.right;

  if (wsWidth < MIN_WORKSPACE_WIDTH) {
    // Workspace too narrow — collapse one visible panel at a time
    if (!leftAutoHidden.value && !rightAutoHidden.value && hasRight) {
      // Both visible: collapse the wider one (right if tied)
      if (rightPanelWidth.value >= leftPanelWidth.value) rightAutoHidden.value = true;
      else leftAutoHidden.value = true;
    } else if (!leftAutoHidden.value && (rightAutoHidden.value || !hasRight)) {
      leftAutoHidden.value = true;
    } else if (!rightAutoHidden.value && hasRight) {
      rightAutoHidden.value = true;
    }
  } else {
    // Workspace wide enough — try to restore (reverse order: narrower first)
    if (leftAutoHidden.value && rightAutoHidden.value) {
      if (leftPanelWidth.value <= rightPanelWidth.value) {
        if (wsWidth - leftPanelWidth.value >= MIN_WORKSPACE_WIDTH) leftAutoHidden.value = false;
      } else {
        if (wsWidth - rightPanelWidth.value >= MIN_WORKSPACE_WIDTH) rightAutoHidden.value = false;
      }
    } else if (leftAutoHidden.value) {
      if (wsWidth - leftPanelWidth.value >= MIN_WORKSPACE_WIDTH) leftAutoHidden.value = false;
    } else if (rightAutoHidden.value) {
      if (wsWidth - rightPanelWidth.value >= MIN_WORKSPACE_WIDTH) rightAutoHidden.value = false;
    }
  }
}

let wsObserver: ResizeObserver | null = null;

onMounted(() => {
  checkAutoHide();
  window.addEventListener('resize', checkAutoHide);
  const wsEl = document.querySelector('.sf-workspace');
  if (wsEl) {
    wsObserver = new ResizeObserver(() => checkAutoHide());
    wsObserver.observe(wsEl);
  }
});
onUnmounted(() => {
  window.removeEventListener('resize', checkAutoHide);
  wsObserver?.disconnect();
  clearTimeout(suppressTimer);
});

/** Effective visibility: user intent, overridden when the workspace is too narrow. */
const effDockerPanelVisible = computed(() =>
  dockerPanelVisible.value && leftPanelVisible.value && !leftAutoHidden.value,
);
const effRightPanelVisible = computed(() =>
  rightPanelVisible.value && !rightAutoHidden.value,
);

const activeDockerItem = computed(
  () => layout.docker.find(d => d.id === activeDockerTag.value) ?? layout.docker[0],
);
const dockerDef = computed(() => activeDockerItem.value?.panel ?? null);

function onTagSelected(tagId: string) {
  if (leftAutoHidden.value) {
    // Left panel is auto-hidden: show it (don't toggle)
    leftAutoHidden.value = false;
    suppressAutoHide();
    if (!leftPanelVisible.value) leftPanelVisible.value = true;
    if (!dockerPanelVisible.value) dockerPanelVisible.value = true;
    if (tagId !== activeDockerTag.value) activeDockerTag.value = tagId;
    return;
  }
  if (!leftPanelVisible.value) leftPanelVisible.value = true;

  if (tagId === activeDockerTag.value && dockerPanelVisible.value) {
    // Same icon, panel open — toggle off
    dockerPanelVisible.value = false;
  } else if (tagId === activeDockerTag.value && !dockerPanelVisible.value) {
    // Same icon, panel collapsed — expand
    dockerPanelVisible.value = true;
  } else {
    // Different icon — switch and expand
    activeDockerTag.value = tagId;
    dockerPanelVisible.value = true;
  }
}

function toggleLeftPanel() {
  if (leftAutoHidden.value) {
    // Left panel is auto-hidden: show it (don't toggle)
    leftAutoHidden.value = false;
    suppressAutoHide();
    if (!leftPanelVisible.value) leftPanelVisible.value = true;
    if (!dockerPanelVisible.value) dockerPanelVisible.value = true;
    return;
  }
  if (leftPanelVisible.value) {
    // Hide: remember panel state, then collapse everything
    savedPanelState.value = dockerPanelVisible.value;
    dockerPanelVisible.value = false;
    leftPanelVisible.value = false;
  } else {
    // Restore: bring back to previous state
    leftPanelVisible.value = true;
    dockerPanelVisible.value = savedPanelState.value;
  }
}

function toggleRightPanel() {
  if (rightAutoHidden.value) {
    // Right panel is auto-hidden: show it (don't toggle)
    rightAutoHidden.value = false;
    suppressAutoHide();
    if (!rightPanelVisible.value) rightPanelVisible.value = true;
    return;
  }
  rightPanelVisible.value = !rightPanelVisible.value;
}

// ── Menu actions: defined in the layout JSON, handled here ────────────────

function onMenuAction(actionId: string) {
  switch (actionId) {
    case 'toggle-left-panel':
      toggleLeftPanel();
      break;
    case 'toggle-right-panel':
      toggleRightPanel();
      break;
    case 'about':
      alert(`Studio Framework v1.0 • ${layout.app.title}`);
      break;
    default:
      console.log('menu action:', actionId);
  }
}
</script>

<template>
  <div class="sf-root">
    <MenuBar
      :menus="layout.menu"
      :left-panel-visible="!leftAutoHidden && leftPanelVisible"
      :right-panel-visible="!rightAutoHidden && rightPanelVisible"
      @toggle-left-panel="toggleLeftPanel"
      @toggle-right-panel="toggleRightPanel"
      @menu-action="onMenuAction"
    />

    <div class="sf-workbench">
      <Docker
        :items="layout.docker"
        :active-tag="activeDockerTag"
        :visible="leftPanelVisible"
        :panel-visible="dockerPanelVisible"
        @tag-selected="onTagSelected"
      />

      <DockerPanel
        v-if="dockerDef"
        :def="dockerDef"
        :visible="effDockerPanelVisible"
        @collapse="dockerPanelVisible = false"
      />

      <Workspace :def="layout.workspace" />

      <RightPanel
        v-if="layout.right"
        :def="layout.right"
        :visible="effRightPanelVisible"
        @collapse="rightPanelVisible = false"
      />
    </div>

    <StatusBar :left="layout.status.left" :right="layout.status.right" />
  </div>
</template>
