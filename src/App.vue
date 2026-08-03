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

// ── Auto-hide panels based on workspace width ─────────────────────────────

/** Minimum workspace width (px) before panels auto-hide. */
const MIN_WORKSPACE_WIDTH = 640;
const leftAutoHidden = ref(false);
const rightAutoHidden = ref(false);

/** Last known panel widths (updated live during drag via @resize emit). */
const leftPanelWidth = ref(260);
const rightPanelWidth = ref(260);

/** One-time guard: prevents the panel-expansion trigger from firing twice
 *  in the same drag. Reset when the panel gets narrower. */
let panelResizeTriggered = false;

/** Workspace width as if all user-intended panels were visible (ignores auto-hidden).
 *  Used by the window-resize trigger so the check is stable (no oscillation). */
function calcWouldBeWorkspaceWidth(): number {
  const dockerW = 48;
  const leftW = (leftPanelVisible.value && dockerPanelVisible.value) ? leftPanelWidth.value : 0;
  const rightW = rightPanelVisible.value ? rightPanelWidth.value : 0;
  return window.innerWidth - dockerW - leftW - rightW;
}

/** Actual workspace width (accounts for auto-hidden panels).
 *  Used by the panel-expansion trigger. */
function calcActualWorkspaceWidth(): number {
  const dockerW = 48;
  const leftW = (leftPanelVisible.value && dockerPanelVisible.value && !leftAutoHidden.value)
    ? leftPanelWidth.value : 0;
  const rightW = (rightPanelVisible.value && !rightAutoHidden.value)
    ? rightPanelWidth.value : 0;
  return window.innerWidth - dockerW - leftW - rightW;
}

// ── Trigger 1: browser window resize → hide/restore BOTH panels ───────────

function onWindowResize() {
  const tooNarrow = calcWouldBeWorkspaceWidth() < MIN_WORKSPACE_WIDTH;
  leftAutoHidden.value = tooNarrow;
  if (layout.right) rightAutoHidden.value = tooNarrow;
}

// ── Trigger 2: panel expansion (drag wider) → hide the OTHER panel (one-time) ──

function onPanelResize(side: 'left' | 'right', newWidth: number) {
  const prev = side === 'left' ? leftPanelWidth.value : rightPanelWidth.value;
  if (side === 'left') leftPanelWidth.value = newWidth;
  else rightPanelWidth.value = newWidth;

  if (newWidth > prev && !panelResizeTriggered) {
    // Panel getting wider: check actual workspace width
    if (calcActualWorkspaceWidth() < MIN_WORKSPACE_WIDTH) {
      // Auto-hide the OTHER panel (one-time)
      if (side === 'left' && layout.right) rightAutoHidden.value = true;
      else leftAutoHidden.value = true;
      panelResizeTriggered = true;
    }
  } else if (newWidth < prev) {
    // Panel getting narrower: reset trigger + revert auto-hide if the
    // workspace is now wide enough for both panels.
    // Uses would-be width (all user-intended panels visible) so the check
    // is stable. Clearing auto-hidden flags does NOT change user intent
    // (leftPanelVisible/rightPanelVisible) - so user-collapsed panels
    // stay collapsed.
    panelResizeTriggered = false;
    if (calcWouldBeWorkspaceWidth() >= MIN_WORKSPACE_WIDTH) {
      leftAutoHidden.value = false;
      rightAutoHidden.value = false;
    }
  }
}

onMounted(() => {
  onWindowResize();
  window.addEventListener('resize', onWindowResize);
});
onUnmounted(() => window.removeEventListener('resize', onWindowResize));

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
        @resize="onPanelResize('left', $event)"
      />

      <Workspace :def="layout.workspace" />

      <RightPanel
        v-if="layout.right"
        :def="layout.right"
        :visible="effRightPanelVisible"
        @collapse="rightPanelVisible = false"
        @resize="onPanelResize('right', $event)"
      />
    </div>

    <StatusBar :left="layout.status.left" :right="layout.status.right" />
  </div>
</template>
