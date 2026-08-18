<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue';
import type { ExternalDropTarget } from '../composables/useWorkspace';
import {
  type DndRect,
  kRightPanelToggle,
  kWorkspace,
  useWorkspace,
  type WorkspaceApi,
} from '../composables/useWorkspace';
import type { WorkspaceDef } from '../types/layout';
import { collectAllTabs, type DropZone, type TileNode } from '../workspace/tree';
import RootSash from './RootSash.vue';
import WorkspaceNode from './WorkspaceNode.vue';

const props = withDefaults(
  defineProps<{
    def: WorkspaceDef;
    rightPanelVisible?: boolean;
    api?: WorkspaceApi;
    mobile?: boolean;
  }>(),
  {
    rightPanelVisible: true,
    mobile: false,
  },
);
const emit = defineEmits<{ 'toggle-right-panel': [] }>();

const api = props.api ?? useWorkspace(props.def);
provide(kWorkspace, api);

const rpToggle = reactive({
  visible: props.rightPanelVisible ?? true,
  toggle: () => emit('toggle-right-panel'),
});
watch(
  () => props.rightPanelVisible,
  (v) => {
    rpToggle.visible = v ?? true;
  },
);
provide(kRightPanelToggle, rpToggle);

const wsEl = ref<HTMLElement | null>(null);

const MOBILE_FLAT_TILE_ID = 'sf-mobile-flat';

const flatNode = computed<TileNode>(() => {
  const tabs: string[] = [];
  for (const root of api.roots) tabs.push(...collectAllTabs(root.node));
  let activeId = tabs[0] ?? '';
  const focused = api.findTileGlobal(api.focusedTileId);
  if (focused?.activeId && tabs.includes(focused.activeId)) activeId = focused.activeId;
  return { kind: 'tile', id: MOBILE_FLAT_TILE_ID, tabs, activeId };
});

const GAP = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sf-sash-size')) || 1;

const RADIUS = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sf-radius')) || 6;

function cornerPx(r: DOMRect, ws: DOMRect, rightSeam: boolean): [number, number, number, number] {
  const near = (a: number, b: number) => Math.abs(a - b) < 2;
  const top = near(r.top, ws.top);
  const bottom = near(r.bottom, ws.bottom);
  const left = near(r.left, ws.left);
  const right = !rightSeam && near(r.right, ws.right);
  const px = (b: boolean) => (b ? RADIUS : 0);
  return [px(top && left), px(top && right), px(bottom && right), px(bottom && left)];
}

const radiusStr = (c: [number, number, number, number]) => `${c[0]}px ${c[1]}px ${c[2]}px ${c[3]}px`;

function halfRadius(zone: DropZone, c: [number, number, number, number]): string {
  if (zone === 'left') return radiusStr([c[0], 0, 0, c[3]]);
  if (zone === 'right') return radiusStr([0, c[1], c[2], 0]);
  if (zone === 'top') return radiusStr([c[0], c[1], 0, 0]);
  return radiusStr([0, 0, c[2], c[3]]);
}

const px = (n: number | undefined) => (n == null ? '0px' : `${n}px`);

function rectStyle(r: { x: number; y: number; w?: number; h: number; radius?: string } | null) {
  return {
    left: px(r?.x),
    top: px(r?.y),
    width: r?.w != null ? px(r.w) : undefined,
    height: px(r?.h),
    borderRadius: r?.radius ?? undefined,
  };
}

function rectToLocal(r: DOMRect, origin: { x: number; y: number }): DndRect {
  return { x: r.left - origin.x, y: r.top - origin.y, w: r.width, h: r.height };
}

function clearHover() {
  api.dnd.tileId = '';
  api.dnd.preview = null;
  api.dnd.glow = null;
  api.dnd.indicator = null;
}

interface TileGeom {
  id: string;
  rect: DOMRect;
  bandW: number;
  bandH: number;
  contentTop: number;
  stripR: DOMRect | null;
  tabRects: DOMRect[];
}

function tileGeom(id: string, el: HTMLElement): TileGeom {
  const rect = el.getBoundingClientRect();
  const bandW = Math.min(Math.max(rect.width * 0.25, 36), 72);
  const bandH = Math.min(Math.max(rect.height * 0.25, 28), 56);
  const strip = el.querySelector<HTMLElement>('.sf-tile-tabs');
  const stripR = strip?.getBoundingClientRect() ?? null;
  const tabRects = (strip ? [...strip.querySelectorAll<HTMLElement>('.sf-tab')] : []).map((t) =>
    t.getBoundingClientRect(),
  );
  const contentTop = (stripR ? stripR.bottom : rect.top) + 6;
  return { id, rect, bandW, bandH, contentTop, stripR, tabRects };
}

let geomCache: TileGeom[] | null = null;

function getGeoms(): TileGeom[] {
  if (geomCache) return geomCache;
  geomCache = [];
  for (const [id, el] of api.tileEls) geomCache.push(tileGeom(id, el));
  return geomCache;
}

function invalidateGeoms() {
  geomCache = null;
}

watch(
  () => [api.dnd.dragging, api.dnd.externalDrop],
  () => {
    geomCache = null;
  },
);
onMounted(() => {
  window.addEventListener('resize', invalidateGeoms);
  window.addEventListener('scroll', invalidateGeoms, true);
});
onUnmounted(() => {
  window.removeEventListener('resize', invalidateGeoms);
  window.removeEventListener('scroll', invalidateGeoms, true);
});

function onDragOver(e: DragEvent) {
  e.preventDefault();
  const external = !api.dnd.dragging && api.acceptsExternal(Array.from(e.dataTransfer?.types ?? []));
  if (!api.dnd.dragging && !external) return;
  if (e.dataTransfer) e.dataTransfer.dropEffect = external ? 'copy' : 'move';
  api.dnd.externalDrop = external;

  const wsRect = wsEl.value?.getBoundingClientRect() ?? null;
  const origin = { x: wsRect?.left ?? 0, y: wsRect?.top ?? 0 };
  const rightSeam = !!props.rightPanelVisible;
  const dnd = api.dnd;

  const geoms = getGeoms();

  const hit = geoms.find(
    (g) =>
      e.clientX >= g.rect.left &&
      e.clientX <= g.rect.right &&
      e.clientY >= g.rect.top &&
      e.clientY <= g.rect.bottom,
  );
  if (!hit) {
    clearHover();
    return;
  }

  const dx = e.clientX - hit.rect.left;
  const dy = e.clientY - hit.rect.top;
  const contentStart = hit.contentTop - hit.rect.top;
  const inStrip =
    !!hit.stripR &&
    hit.stripR.height > 0 &&
    e.clientY >= hit.stripR.top - 6 &&
    e.clientY <= hit.stripR.bottom + 6;
  let zone: DropZone = 'center';
  if (inStrip) {
    zone = 'center';
  } else if (dx < hit.bandW) {
    zone = 'left';
  } else if (dx > hit.rect.width - hit.bandW) {
    zone = 'right';
  } else if (dy - contentStart < hit.bandH) {
    zone = 'top';
  } else if (dy > hit.rect.height - hit.bandH) {
    zone = 'bottom';
  }

  dnd.tileId = hit.id;
  dnd.zone = zone;

  if (zone === 'center') {
    dnd.preview = null;
    const glow = rectToLocal(hit.rect, origin);
    if (wsRect) glow.radius = radiusStr(cornerPx(hit.rect, wsRect, rightSeam));
    dnd.glow = glow;
    const tile = api.findTileGlobal(hit.id);
    const tabCount = tile ? tile.tabs.length : 0;
    if (inStrip && hit.stripR) {
      let idx = 0;
      for (const tr of hit.tabRects) {
        if (e.clientX > tr.left + tr.width / 2) idx += 1;
      }
      dnd.index = idx;
      const left = idx < hit.tabRects.length ? hit.tabRects[idx].left : hit.stripR.right - 1;
      dnd.indicator = { x: left - origin.x, y: hit.stripR.top - origin.y, h: hit.stripR.height };
    } else {
      dnd.index = tabCount;
      dnd.indicator = null;
    }
  } else {
    dnd.glow = null;
    dnd.indicator = null;
    dnd.index = 0;
    const r = hit.rect;
    const corners = wsRect
      ? cornerPx(r, wsRect, rightSeam)
      : ([0, 0, 0, 0] as [number, number, number, number]);
    const radius = halfRadius(zone, corners);
    const isRow = zone === 'left' || zone === 'right';
    const isStart = zone === 'left' || zone === 'top';
    const dim = isRow ? r.width : r.height;
    const offset = isStart ? 0 : (dim + GAP) / 2;
    dnd.preview = {
      x: r.left - origin.x + (isRow ? offset : 0),
      y: r.top - origin.y + (isRow ? 0 : offset),
      w: isRow ? (dim - GAP) / 2 : r.width,
      h: isRow ? r.height : (dim - GAP) / 2,
      radius,
    };
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  if (api.dnd.externalDrop) {
    const target: ExternalDropTarget = { tileId: api.dnd.tileId, zone: api.dnd.zone, index: api.dnd.index };
    api.endDrag();
    if (!target.tileId) return;
    api.deliverExternalDrop(e, target);
    return;
  }
  if (!api.dnd.dragging) return;

  const { tabId, sourceTileId, tileId, zone, index, fromIndex } = api.dnd;
  api.endDrag();
  if (!tabId || !tileId) return;

  if (zone === 'center') {
    if (sourceTileId === tileId && (index === fromIndex || index === fromIndex + 1)) return;
    api.ops.moveTab(tabId, tileId, index);
  } else {
    const dir = zone === 'left' || zone === 'right' ? 'row' : 'column';
    const side = zone === 'left' || zone === 'top' ? 'start' : 'end';
    api.ops.splitTile(tileId, dir, side, tabId);
  }
}

function onDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Node | null;
  if (related && wsEl.value?.contains(related)) return;
  clearHover();
}
</script>

<template>
  <div
    ref="wsEl"
    class="sf-workspace"
    @dragover="onDragOver"
    @drop="onDrop"
    @dragleave="onDragLeave"
  >
    <div class="sf-workspace-inner" :class="api.rootDir === 'column' ? 'sf-workspace-inner--col' : ''">
      <template v-if="mobile">
        <WorkspaceNode :node="flatNode" />
      </template>
      <template v-else>
        <template v-for="(root, i) in api.roots" :key="root.id">
          <div class="sf-root-group" :style="{ flexBasis: root.ratio * 100 + '%' }">
            <WorkspaceNode :node="root.node" />
          </div>
          <RootSash v-if="i < api.roots.length - 1" :index="i" />
        </template>
      </template>
    </div>

    <div v-if="!mobile && (api.dnd.dragging || api.dnd.externalDrop)" class="sf-dnd-layer">
      <div v-if="api.dnd.preview" class="sf-dnd-preview" :style="rectStyle(api.dnd.preview)" />
      <div v-if="api.dnd.glow && !api.dnd.preview" class="sf-dnd-glow" :style="rectStyle(api.dnd.glow)" />
      <div v-if="api.dnd.indicator" class="sf-dnd-indicator" :style="rectStyle(api.dnd.indicator)" />
    </div>
  </div>
</template>
