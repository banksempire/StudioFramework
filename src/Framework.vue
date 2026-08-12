<script lang="ts">
import type { WorkspaceApi } from './composables/useWorkspace';
import type { PanelAction } from './types/panel';

/**
 * An action bubbling up from the layout to the host app:
 * - menu:    a menu leaf was clicked (action id from the layout)
 * - utility: a sub-section utility button was clicked (subId + utility id)
 * - panel:   a panel component produced an action (button/list/tree/custom)
 */
export interface FrameworkAction {
  source: 'menu' | 'utility' | 'panel';
  action?: string;
  subId?: string;
  /** emitting panel component: built-in type or custom layout key */
  component?: string;
  payload?: unknown;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref } from 'vue';
import { loadLayout } from './layout/loadLayout';
import type { LayoutDefinition } from './types/layout';
import MenuBar from './components/MenuBar.vue';
import Docker from './components/Docker.vue';
import Icon from './components/Icon.vue';
import Panel from './components/Panel.vue';
import Workspace from './components/Workspace.vue';
import StatusBar from './components/StatusBar.vue';
import { kWorkspace, useWorkspace } from './composables/useWorkspace';

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

// ── Workspace API (root-level provide: available to panels AND tiles) ──────

const api = useWorkspace(L.workspace);
provide(kWorkspace, api);
onMounted(() => emit('workspace-ready', api));

const activeDockerApp = ref(L.docker[0]?.id ?? '');
const leftPanelVisible = ref(true);
const dockerPanelVisible = ref(true);
const savedPanelState = ref(true);
const rightPanelVisible = ref(true);

// ── Mobile mode ──────────────────────────────────────────────────────────
// Below 500px the layout switches to a phone-style chrome: menu bar and
// status bar are hidden, both side panels are replaced by a bottom dock,
// and tapping a dock app opens its panel fullscreen. The workspace keeps
// its real tile tree untouched — it is only PRESENTED as a single flat
// tile with all tabs while mobile (see Workspace.vue); the structure
// resumes exactly when the window widens again.

const MOBILE_BREAKPOINT = 500;
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT);
/** Fullscreen app panel opened from the bottom dock (mobile only). */
const mobilePanelOpen = ref(false);
/** Fullscreen right panel opened from the mobile tile bar (mobile only). */
const mobileRightOpen = ref(false);

// ── Panel visibility ↔ workspace snapshots ────────────────────────────────
// Snapshots (auto-saved layout + saved workspaces) carry the side panels'
// expand/collapse state, so loading a workspace restores it too. The
// auto-hidden flags are width-guard transients and stay out of it.
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
    // A restored workspace must respect the CURRENT window width: re-run
    // the auto-hide check, or the panels pop open on a window too narrow
    // for them (e.g. an auto-hide override + workspace load). Deferred —
    // the boot restore applies panels before the auto-hide state refs
    // exist (setup order). Forced: a load re-enforces even when the width
    // did not change.
    void nextTick(() => onWindowResize(true));
  },
});

// ── Auto-hide panels based on workspace width ─────────────────────────────

/** Minimum workspace width (px) before panels auto-hide. */
const MIN_WORKSPACE_WIDTH = 640;
const DOCKER_WIDTH = 48;
const leftAutoHidden = ref(false);
const rightAutoHidden = ref(false);

/** Last known panel widths (updated live during drag via @resize emit). */
const leftPanelWidth = ref(260);
const rightPanelWidth = ref(260);

/** One-time guard: prevents the panel-expansion trigger from firing twice
 *  in the same drag. Reset when the panel gets narrower. */
let panelResizeTriggered = false;

/** Workspace width. ignoreAutoHidden=true treats all user-intended panels as
 *  visible (used by window-resize trigger + revert check for stability).
 *  false accounts for auto-hidden (used by panel-expansion trigger). */
function calcWorkspaceWidth(ignoreAutoHidden: boolean): number {
  const leftOn = leftPanelVisible.value && dockerPanelVisible.value
    && (ignoreAutoHidden || !leftAutoHidden.value);
  const rightOn = rightPanelVisible.value
    && (ignoreAutoHidden || !rightAutoHidden.value);
  return window.innerWidth - DOCKER_WIDTH
    - (leftOn ? leftPanelWidth.value : 0)
    - (rightOn ? rightPanelWidth.value : 0);
}

// ── Trigger 1: browser window resize → hide/restore BOTH panels ───────────

/** Window width (px) at which the current auto-hide state was decided.
 *  The guard re-enforces only when the window gets NARROWER than this —
 *  height-only resizes and widening-while-still-narrow must not stomp a
 *  user override (e.g. a docker click that re-opened an auto-hidden
 *  panel). Workspace applies / the boot mount force a re-evaluation. */
let autoHideDecidedAt: number | null = null;

function onWindowResize(force = false) {
  // Mobile layout replaces the side panels entirely (bottom dock) — the
  // width guard is a desktop concern.
  if (isMobile.value) return;
  const w = window.innerWidth;
  const wAll = calcWorkspaceWidth(true);
  if (wAll >= MIN_WORKSPACE_WIDTH) {
    autoHideDecidedAt = w;
    leftAutoHidden.value = false;
    rightAutoHidden.value = false;
    return;
  }
  // Too narrow. A user override — a docker click (or panel toggle) that
  // re-opened an auto-hidden panel while the window is still narrow — must
  // survive height-only resizes and widening-while-still-narrow: only a
  // genuine shrink past the last decision point (or a forced re-evaluation:
  // workspace apply / boot) re-enforces the guard.
  const overridden =
    (leftPanelVisible.value && dockerPanelVisible.value && !leftAutoHidden.value) ||
    (rightPanelVisible.value && !!L.right && !rightAutoHidden.value);
  if (!force && overridden && autoHideDecidedAt !== null && w >= autoHideDecidedAt) return;
  autoHideDecidedAt = w;
  // Too narrow: hide left first, then right (progressive)
  const leftIntended = leftPanelVisible.value && dockerPanelVisible.value;
  // Workspace width if we hide left (add back its width)
  const wNoLeft = wAll + (leftIntended ? leftPanelWidth.value : 0);
  if (wNoLeft >= MIN_WORKSPACE_WIDTH) {
    // Hiding left is enough; right stays visible
    leftAutoHidden.value = leftIntended;
    rightAutoHidden.value = false;
  } else {
    // Still too narrow: hide both
    leftAutoHidden.value = leftIntended;
    rightAutoHidden.value = rightPanelVisible.value && !!L.right;
  }
}

// ── Trigger 2: panel expansion (drag wider) → hide the OTHER panel (one-time) ──

function onPanelResize(side: 'left' | 'right', newWidth: number) {
  const prev = side === 'left' ? leftPanelWidth.value : rightPanelWidth.value;
  if (side === 'left') leftPanelWidth.value = newWidth;
  else rightPanelWidth.value = newWidth;

  if (newWidth > prev && !panelResizeTriggered) {
    // Panel getting wider: check actual workspace width
    if (calcWorkspaceWidth(false) < MIN_WORKSPACE_WIDTH) {
      // Auto-hide the OTHER panel (one-time)
      if (side === 'left' && L.right) rightAutoHidden.value = true;
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

/** Effective visibility: user intent, overridden when the workspace is too narrow. */
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
    // Bottom dock: tapping an app opens its panel fullscreen; tapping the
    // open app again closes it.
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
    // Auto-hidden (width guard): the PANEL is off but the docker bar is
    // still visible — the toggle keeps its normal job and collapses the
    // whole group. The next click restores it and clears the auto-hide
    // (user override), exactly like the reveal-from-collapsed path below.
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
    showAutoHiddenRight();
    return;
  }
  rightPanelVisible.value = !rightPanelVisible.value;
}

/** Right-panel toggle from the workspace tile bar: on mobile it opens the
 *  right panel fullscreen (mobileRightOpen) instead of the desktop
 *  collapse/expand. */
function onWorkspaceToggleRightPanel() {
  if (isMobile.value) {
    mobileRightOpen.value = !mobileRightOpen.value;
    if (mobileRightOpen.value) mobilePanelOpen.value = false;
    return;
  }
  toggleRightPanel();
}

// ── Menu actions: framework-internal ones handled here, the rest are ──────
//    forwarded to the host app so it can react to its own layout. ──────────

function onMenuAction(actionId: string) {
  switch (actionId) {
    case 'toggle-left-panel':
      toggleLeftPanel();
      break;
    case 'toggle-right-panel':
      toggleRightPanel();
      break;
    case 'about':
      alert(L.framework.title);
      break;
    default:
      emit('action', { source: 'menu', action: actionId });
  }
}

function onPanelUtility(subId: string, utilityId: string) {
  emit('action', { source: 'utility', subId, action: utilityId });
}

function onPanelAction(a: PanelAction) {
  emit('action', { source: 'panel', component: a.source, action: a.action, payload: a.payload });
}
</script>

<template>
  <div class="sf-root" :class="{ 'sf-root--mobile': isMobile }">
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
          :sections="dockerDef.sections"
          :visible="effDockerPanelVisible"
          position="left"
          @collapse="dockerPanelVisible = false"
          @resize="onPanelResize('left', $event)"
          @utility="onPanelUtility"
          @component-action="onPanelAction"
        />
      </div>

      <!-- Workspace + right panel share one rounded box, separated by a
           thin border: (tile1|tile2|right panel) -->
      <div class="sf-center-group">
        <Workspace
          :def="L.workspace"
          :api="api"
          :mobile="isMobile"
          :right-panel-visible="isMobile ? mobileRightOpen : !!L.right && !rightAutoHidden && rightPanelVisible"
          @toggle-right-panel="onWorkspaceToggleRightPanel"
        />

        <Panel
          v-if="L.right && !isMobile"
          :title="L.right.title"
          :sections="L.right.sections"
          :visible="effRightPanelVisible"
          position="right"
          @collapse="rightPanelVisible = false"
          @resize="onPanelResize('right', $event)"
          @utility="onPanelUtility"
          @component-action="onPanelAction"
        />
      </div>
    </div>

    <!-- Mobile: bottom dock + fullscreen app panels (menu/status bars
         hidden; the workspace shows one flat tile with all tabs). -->
    <template v-if="isMobile">
      <Docker
        position="bottom"
        :items="L.docker"
        :active-app="activeDockerApp"
        :panel-visible="mobilePanelOpen"
        @app-selected="onAppSelected"
      />
      <div v-if="mobilePanelOpen && dockerDef" class="sf-mobile-panel">
        <div class="sf-mobile-panel-bar">
          <Icon v-if="activeDockerItem" class="sf-mobile-panel-icon" :icon="activeDockerItem.icon" />
          <span class="sf-mobile-panel-title">{{ activeDockerItem?.displayName ?? dockerDef.title }}</span>
          <button class="sf-mobile-panel-close" title="Close panel" @click="mobilePanelOpen = false">✕</button>
        </div>
        <Panel
          :title="dockerDef.title"
          :sections="dockerDef.sections"
          :visible="true"
          position="mobile"
          @utility="onPanelUtility"
          @component-action="onPanelAction"
        />
      </div>
      <div v-if="mobileRightOpen && L.right" class="sf-mobile-panel">
        <div class="sf-mobile-panel-bar">
          <span class="sf-mobile-panel-title">{{ L.right.title }}</span>
          <button class="sf-mobile-panel-close" title="Close panel" @click="mobileRightOpen = false">✕</button>
        </div>
        <Panel
          :title="L.right.title"
          :sections="L.right.sections"
          :visible="true"
          position="mobile"
          @utility="onPanelUtility"
          @component-action="onPanelAction"
        />
      </div>
    </template>

    <StatusBar v-if="!isMobile" :left="L.status.left" :right="L.status.right" />
  </div>
</template>
