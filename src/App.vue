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

/** Below this width (px), both panels auto-hide to give the workspace room. */
const AUTO_HIDE_THRESHOLD = 700;
const autoHidden = ref(false);

function onResize() {
  autoHidden.value = window.innerWidth < AUTO_HIDE_THRESHOLD;
}

onMounted(() => {
  onResize();
  window.addEventListener('resize', onResize);
});
onUnmounted(() => window.removeEventListener('resize', onResize));

/** Effective visibility: user intent, overridden when the window is too narrow. */
const effDockerPanelVisible = computed(() =>
  dockerPanelVisible.value && leftPanelVisible.value && !autoHidden.value,
);
const effRightPanelVisible = computed(() =>
  rightPanelVisible.value && !autoHidden.value,
);

const activeDockerItem = computed(
  () => layout.docker.find(d => d.id === activeDockerTag.value) ?? layout.docker[0],
);
const dockerDef = computed(() => activeDockerItem.value?.panel ?? null);

function onTagSelected(tagId: string) {
  if (autoHidden.value) {
    // Panels are auto-hidden: show them (don't toggle)
    autoHidden.value = false;
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
  if (autoHidden.value) {
    // Panels are auto-hidden: show them (don't toggle)
    autoHidden.value = false;
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
  if (autoHidden.value) {
    // Panels are auto-hidden: show them (don't toggle)
    autoHidden.value = false;
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
      :left-panel-visible="!autoHidden && leftPanelVisible"
      :right-panel-visible="!autoHidden && rightPanelVisible"
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
