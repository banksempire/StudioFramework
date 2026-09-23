<script lang="ts">
import type { WorkspaceApi } from './composables/useWorkspace';
import type { PanelDef } from './types/layout';
import type { PanelAction } from './types/panel';

export interface FrameworkAction {
  source: 'menu' | 'utility' | 'panel';
  action?: string;
  subId?: string;
  component?: string;
  payload?: unknown;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { loadLayout } from './layout/loadLayout';
import type { LayoutDefinition } from './types/layout';
import MenuBar from './components/MenuBar.vue';
import Docker from './components/Docker.vue';
import Panel from './components/Panel.vue';
import Workspace from './components/Workspace.vue';
import StatusBar from './components/StatusBar.vue';
import SvgIcon from './components/SvgIcon.vue';
import {
  DEFAULT_PANEL_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
} from './composables/useResize';
import { readUiNumber, readUiString, writeUiValue, applyUiValues, readAllUiValues, uiEpoch } from './uiState';
import { findTile } from './workspace/tree';
import { kIsMobile, kMobilePanelDismiss, kTitleBarMenus, kWorkspace, useWorkspace } from './composables/useWorkspace';

const props = withDefaults(defineProps<{
  layout?: LayoutDefinition;
}>(), {
  layout: () => loadLayout(),
});
const L = props.layout;

const emit = defineEmits<{
  action: [payload: FrameworkAction];
  'workspace-ready': [api: WorkspaceApi];
}>();


const api = useWorkspace(L.workspace);
provide(kWorkspace, api);
provide(kTitleBarMenus, { menus: L.menu, onAction: onMenuAction });
onMounted(() => emit('workspace-ready', api));

const persistedApp = readUiString('panel.activeApp');
const activeDockerApp = ref(
  persistedApp && L.docker.some((d) => d.id === persistedApp) ? persistedApp : (L.docker[0]?.id ?? ''),
);
watch(activeDockerApp, (id) => writeUiValue('panel.activeApp', id));
const leftPanelVisible = ref(true);
const dockerPanelVisible = ref(true);
const savedPanelState = ref(true);
const rightPanelVisible = ref(true);


const MOBILE_BREAKPOINT = 500;
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT);
provide(kIsMobile, isMobile);
const mobilePanelOpen = ref(false);
const mobileRightOpen = ref(false);
provide(kMobilePanelDismiss, () => {
  if (!isMobile.value) return;
  mobilePanelOpen.value = false;
  mobileRightOpen.value = false;
});
const STATUS_SLOT = 38; 
const statusReveal = ref(1);
const statusDragging = ref(false);
let dragStartReveal = 1;

function onStatusDrag(dy: number) {
  if (!statusDragging.value) {
    dragStartReveal = statusReveal.value;
    statusDragging.value = true;
  }
  statusReveal.value = Math.min(1, Math.max(0, dragStartReveal - dy / STATUS_SLOT));
}

function onStatusSettle(show: boolean) {
  statusDragging.value = false;
  statusReveal.value = show ? 1 : 0;
}

api.setPanelStateProvider({
  read: () => ({
    left: leftPanelVisible.value,
    docker: dockerPanelVisible.value,
    right: rightPanelVisible.value,
  }),
  apply: (panels) => {
    leftPanelVisible.value = panels.left;
    dockerPanelVisible.value = panels.docker;
    rightPanelVisible.value = panels.right;
    void nextTick(() => onWindowResize(true));
  },
});

watch(uiEpoch, () => {
  leftPanelWidth.value = restorePanelWidth('panel.width.left');
  rightPanelWidth.value = restorePanelWidth('panel.width.right');
  const app = readUiString('panel.activeApp');
  if (app && L.docker.some((d) => d.id === app)) activeDockerApp.value = app;
  void nextTick(() => onWindowResize(true));
});

api.setUiStateProvider({
  read: () => readAllUiValues(),
  apply: (values) => applyUiValues(values),
});


const MIN_WORKSPACE_WIDTH = 640;
const DOCKER_WIDTH = 48;
const leftAutoHidden = ref(false);
const rightAutoHidden = ref(false);

function restorePanelWidth(key: string): number {
  const v = readUiNumber(key);
  if (v === undefined) return DEFAULT_PANEL_WIDTH;
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, v));
}

const leftPanelWidth = ref(restorePanelWidth('panel.width.left'));
const rightPanelWidth = ref(restorePanelWidth('panel.width.right'));

let panelResizeTriggered = false;

function calcWorkspaceWidth(ignoreAutoHidden: boolean): number {
  const leftOn = leftPanelVisible.value && dockerPanelVisible.value
    && (ignoreAutoHidden || !leftAutoHidden.value);
  const rightOn = rightPanelVisible.value
    && (ignoreAutoHidden || !rightAutoHidden.value);
  return window.innerWidth - DOCKER_WIDTH
    - (leftOn ? leftPanelWidth.value : 0)
    - (rightOn ? rightPanelWidth.value : 0);
}


let autoHideDecidedAt: number | null = null;

function onWindowResize(force = false) {
  if (isMobile.value) return;
  const w = window.innerWidth;
  const wAll = calcWorkspaceWidth(true);
  if (wAll >= MIN_WORKSPACE_WIDTH) {
    autoHideDecidedAt = w;
    leftAutoHidden.value = false;
    rightAutoHidden.value = false;
    return;
  }
  const overridden =
    (leftPanelVisible.value && dockerPanelVisible.value && !leftAutoHidden.value) ||
    (rightPanelVisible.value && !rightAutoHidden.value);
  if (!force && overridden && autoHideDecidedAt !== null && w >= autoHideDecidedAt) return;
  autoHideDecidedAt = w;
  const leftIntended = leftPanelVisible.value && dockerPanelVisible.value;
  const wNoLeft = wAll + (leftIntended ? leftPanelWidth.value : 0);
  if (wNoLeft >= MIN_WORKSPACE_WIDTH) {
    leftAutoHidden.value = leftIntended;
    rightAutoHidden.value = false;
  } else {
    leftAutoHidden.value = leftIntended;
    rightAutoHidden.value = rightPanelVisible.value;
  }
}


function onPanelResize(side: 'left' | 'right', newWidth: number) {
  const prev = side === 'left' ? leftPanelWidth.value : rightPanelWidth.value;
  if (side === 'left') leftPanelWidth.value = newWidth;
  else rightPanelWidth.value = newWidth;
  writeUiValue(`panel.width.${side}`, newWidth);

  if (newWidth > prev && !panelResizeTriggered) {
    if (calcWorkspaceWidth(false) < MIN_WORKSPACE_WIDTH) {
      if (side === 'left') rightAutoHidden.value = true;
      else leftAutoHidden.value = true;
      panelResizeTriggered = true;
    }
  } else if (newWidth < prev) {
    panelResizeTriggered = false;
    if (calcWorkspaceWidth(true) >= MIN_WORKSPACE_WIDTH) {
      leftAutoHidden.value = false;
      rightAutoHidden.value = false;
    }
  }
}

const onResize = () => {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
  onWindowResize();
};
onMounted(() => {
  onWindowResize();
  window.addEventListener('resize', onResize);
});
onUnmounted(() => window.removeEventListener('resize', onResize));

type NavStandalone = Navigator & { standalone?: boolean };
const standaloneMq = window.matchMedia('(display-mode: standalone)');
const isStandaloneDisplay = () =>
  standaloneMq.matches || (window.navigator as NavStandalone).standalone === true;
const applyAppHeight = () => {
  if (!isStandaloneDisplay()) {
    document.documentElement.style.removeProperty('--sf-app-height');
    return;
  }
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const full = portrait ? window.screen.height : window.screen.width;
  document.documentElement.style.setProperty('--sf-app-height', `${full}px`);
};
onMounted(() => {
  const vv = window.visualViewport;
  vv?.addEventListener('resize', applyAppHeight);
  vv?.addEventListener('scroll', applyAppHeight);
  window.addEventListener('resize', applyAppHeight);
  window.addEventListener('orientationchange', applyAppHeight);
  standaloneMq.addEventListener('change', applyAppHeight);
  applyAppHeight();
});
onUnmounted(() => {
  const vv = window.visualViewport;
  vv?.removeEventListener('resize', applyAppHeight);
  vv?.removeEventListener('scroll', applyAppHeight);
  window.removeEventListener('resize', applyAppHeight);
  window.removeEventListener('orientationchange', applyAppHeight);
  standaloneMq.removeEventListener('change', applyAppHeight);
});

const effDockerPanelVisible = computed(() =>
  dockerPanelVisible.value && leftPanelVisible.value && !leftAutoHidden.value,
);
const effRightPanelVisible = computed(() =>
  rightPanelVisible.value && !rightAutoHidden.value,
);

const activeDockerItem = computed(
  () => L.docker.find(d => d.id === activeDockerApp.value) ?? L.docker[0],
);
const dockerDef = computed(() => activeDockerItem.value?.panel ?? null);

type RightResolution = { kind: 'ok'; def: PanelDef } | { kind: 'missing'; name: string };

const rightDef = computed<RightResolution>(() => {
  for (const root of api.roots) {
    const tile = findTile(root.node, api.focusedTileId);
    if (!tile) continue;
    const def = api.tabDefs[tile.activeId];
    const name = def?.content ?? def?.id ?? 'right';
    const variant = name ? L.rightPanels?.[name] : undefined;
    return variant ? { kind: 'ok', def: variant } : { kind: 'missing', name };
  }
  return { kind: 'missing', name: 'right' };
});

const rightPanelShown = computed(() => !rightAutoHidden.value && rightPanelVisible.value);


function showAutoHiddenLeft() {
  leftAutoHidden.value = false;
  if (!leftPanelVisible.value) leftPanelVisible.value = true;
  if (!dockerPanelVisible.value) dockerPanelVisible.value = true;
}

function showAutoHiddenRight() {
  rightAutoHidden.value = false;
  if (!rightPanelVisible.value) rightPanelVisible.value = true;
}

function onAppSelected(appId: string) {
  if (isMobile.value) {
    api.dismissMobileSheets();
    if (appId === activeDockerApp.value && mobilePanelOpen.value) {
      mobilePanelOpen.value = false;
    } else {
      activeDockerApp.value = appId;
      mobilePanelOpen.value = true;
      mobileRightOpen.value = false;
    }
    return;
  }
  if (leftAutoHidden.value) {
    showAutoHiddenLeft();
    if (appId !== activeDockerApp.value) activeDockerApp.value = appId;
    return;
  }
  if (!leftPanelVisible.value) leftPanelVisible.value = true;

  if (appId === activeDockerApp.value) {
    dockerPanelVisible.value = !dockerPanelVisible.value;
  } else {
    activeDockerApp.value = appId;
    dockerPanelVisible.value = true;
  }
}

function toggleLeftPanel() {
  if (leftAutoHidden.value) {
    if (leftPanelVisible.value) {
      savedPanelState.value = dockerPanelVisible.value;
      dockerPanelVisible.value = false;
      leftPanelVisible.value = false;
    } else {
      leftPanelVisible.value = true;
      dockerPanelVisible.value = savedPanelState.value;
      leftAutoHidden.value = false;
    }
    return;
  }
  if (leftPanelVisible.value) {
    savedPanelState.value = dockerPanelVisible.value;
    dockerPanelVisible.value = false;
    leftPanelVisible.value = false;
  } else {
    leftPanelVisible.value = true;
    dockerPanelVisible.value = savedPanelState.value;
  }
}

function toggleRightPanel() {
  if (rightAutoHidden.value) {
    showAutoHiddenRight();
    return;
  }
  rightPanelVisible.value = !rightPanelVisible.value;
}

function onWorkspaceToggleRightPanel() {
  if (isMobile.value) {
    mobileRightOpen.value = !mobileRightOpen.value;
    if (mobileRightOpen.value) mobilePanelOpen.value = false;
    return;
  }
  toggleRightPanel();
}


function onMenuAction(actionId: string) {
  switch (actionId) {
    case 'toggle-left-panel':
      toggleLeftPanel();
      break;
    case 'toggle-right-panel':
      toggleRightPanel();
      break;
    default:
      emit('action', { source: 'menu', action: actionId });
  }
}

function utilityClosesMobilePanel(subId: string, utilityId: string): boolean {
  const panels = [dockerDef.value, rightDef.value.kind === 'ok' ? rightDef.value.def : null];
  for (const panel of panels) {
    for (const group of panel?.groups ?? []) {
      for (const sub of group.sections) {
        if (sub.id !== subId) continue;
        if (sub.utilities?.some((u) => u.id === utilityId && u.closeMobilePanel)) return true;
      }
    }
  }
  return false;
}

function onPanelUtility(subId: string, utilityId: string, itemId?: string) {
  if (utilityClosesMobilePanel(subId, utilityId)) {
    mobilePanelOpen.value = false;
    mobileRightOpen.value = false;
  }
  emit('action', { source: 'utility', subId, action: utilityId, payload: itemId });
}

function onPanelAction(a: PanelAction) {
  emit('action', { source: 'panel', component: a.source, action: a.action, payload: a.payload });
}
</script>

<template>
  <div
    class="sf-root"
    :class="{
      'sf-root--mobile': isMobile,
      'sf-status-dragging': isMobile && statusDragging,
    }"
    :style="{ '--sf-status-reveal': String(statusReveal) }"
  >
    <MenuBar
      v-if="!isMobile"
      :menus="L.menu"
      :left-panel-visible="leftPanelVisible"
      @toggle-left-panel="toggleLeftPanel"
      @menu-action="onMenuAction"
    />

    <div class="sf-workbench">
      <div v-if="!isMobile" class="sf-left-group" v-show="leftPanelVisible">
        <Docker
          :items="L.docker"
          :active-app="activeDockerApp"
          :panel-visible="dockerPanelVisible"
          @app-selected="onAppSelected"
        />

        <Panel
          v-if="dockerDef"
          :title="dockerDef.title"
          :groups="dockerDef.groups"
          :visible="effDockerPanelVisible"
          :width="leftPanelWidth"
          :state-key="'docker:' + activeDockerApp"
          position="left"
          @collapse="dockerPanelVisible = false"
          @resize="onPanelResize('left', $event)"
          @utility="onPanelUtility"
          @component-action="onPanelAction"
        />
      </div>

      <div class="sf-center-group">
        <Workspace
          :def="L.workspace"
          :api="api"
          :mobile="isMobile"
          :right-panel-visible="isMobile ? mobileRightOpen : rightPanelShown"
          @toggle-right-panel="onWorkspaceToggleRightPanel"
        />

        <Panel
          v-if="rightDef.kind === 'ok' && !isMobile"
          :title="rightDef.def.title"
          :groups="rightDef.def.groups"
          :visible="effRightPanelVisible"
          :width="rightPanelWidth"
          state-key="right"
          position="right"
          @collapse="rightPanelVisible = false"
          @resize="onPanelResize('right', $event)"
          @utility="onPanelUtility"
          @component-action="onPanelAction"
        />
        <div
          v-else-if="!isMobile"
          class="sf-panel sf-panel--right sf-panel--missing"
          :style="{ width: rightPanelWidth + 'px' }"
          :class="{ 'sf-panel--hidden': !effRightPanelVisible }"
        >
          <div class="sf-panel-header">
            <span class="sf-panel-title">Info Panel</span>
          </div>
          <div class="sf-panel-missing">Panel layout undefined</div>
        </div>
      </div>
    </div>

    <template v-if="isMobile">
      <Docker
        position="bottom"
        :items="L.docker"
        :active-app="activeDockerApp"
        :panel-visible="mobilePanelOpen"
        @app-selected="onAppSelected"
        @status-drag="onStatusDrag"
        @status-settle="onStatusSettle"
      />
      <div v-if="mobilePanelOpen && dockerDef" class="sf-mobile-panel">
        <Panel
          :title="dockerDef.title"
          :groups="dockerDef.groups"
          :visible="true"
          :state-key="'docker:' + activeDockerApp"
          position="mobile"
          @close="mobilePanelOpen = false"
          @utility="onPanelUtility"
          @component-action="onPanelAction"
        />
      </div>
      <div v-if="mobileRightOpen" class="sf-mobile-panel">
        <Panel
          v-if="rightDef.kind === 'ok'"
          :title="rightDef.def.title"
          :groups="rightDef.def.groups"
          :visible="true"
          state-key="right"
          position="mobile"
          @close="mobileRightOpen = false"
          @utility="onPanelUtility"
          @component-action="onPanelAction"
        />
        <div v-else class="sf-panel sf-panel--mobile sf-panel--missing">
          <div class="sf-panel-header">
            <span class="sf-panel-title">Info Panel</span>
            <button
              class="sf-panel-close-btn"
              title="Close panel"
              @click="mobileRightOpen = false"
            ><SvgIcon name="✕" /></button>
          </div>
          <div class="sf-panel-missing">Panel layout undefined</div>
        </div>
      </div>
    </template>

    <StatusBar :left="L.status.left" :right="L.status.right" />
    <slot name="overlay" />
  </div>
</template>
