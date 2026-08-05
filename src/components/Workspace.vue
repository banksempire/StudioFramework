<script setup lang="ts">
import { provide, reactive, ref, watch } from 'vue';
import { kWorkspace, useWorkspace, type WorkspaceApi, type DndRect, kRightPanelToggle } from '../composables/useWorkspace';
import type { WorkspaceDef } from '../types/layout';
import type { DropZone } from '../workspace/tree';
import WorkspaceNode from './WorkspaceNode.vue';
import RootSash from './RootSash.vue';

const props = withDefaults(defineProps<{
  def: WorkspaceDef;
  rightPanelVisible?: boolean;
  /** shared workspace api (created by the framework root when provided) */
  api?: WorkspaceApi;
}>(), {
  rightPanelVisible: true,
});
const emit = defineEmits<{ 'toggle-right-panel': [] }>();

// Use the shared api when given (single source of truth across panels +
// tiles); otherwise create a local one (standalone usage).
const api = props.api ?? useWorkspace(props.def);
provide(kWorkspace, api);

// Provide right-panel toggle info to tiles
const rpToggle = reactive({
  visible: props.rightPanelVisible ?? true,
  toggle: () => emit('toggle-right-panel'),
});
watch(() => props.rightPanelVisible, (v) => { rpToggle.visible = v ?? true; });
provide(kRightPanelToggle, rpToggle);

const wsEl = ref<HTMLElement | null>(null);

/** Tile seam size (--sf-sash-size); previews must account for it so the
 *  landing box matches the shape the split will actually produce. */
const GAP =
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sf-sash-size')) || 1;

/** Box corner radius (--sf-radius), for preview corners at the workspace edge. */
const RADIUS =
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sf-radius')) || 6;

/** Per-corner radius (tl tr br bl): only corners sitting on the workspace's
 *  outer corners round; seams and interior edges stay sharp. When the right
 *  panel is expanded, the workspace's right edge is a seam — never round. */
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

/** Zero out the corners on the seam side of a half-preview. */
function halfRadius(zone: DropZone, c: [number, number, number, number]): string {
  if (zone === 'left') return radiusStr([c[0], 0, 0, c[3]]);
  if (zone === 'right') return radiusStr([0, c[1], c[2], 0]);
  if (zone === 'top') return radiusStr([c[0], c[1], 0, 0]);
  return radiusStr([0, 0, c[2], c[3]]);
}

const px = (n: number | undefined) => (n == null ? '0px' : `${n}px`);

/** Shared style builder for the DnD overlay rects (preview, glow, indicator). */
function rectStyle(r: { x: number; y: number; w?: number; h: number; radius?: string } | null) {
  return {
    left: px(r?.x),
    top: px(r?.y),
    width: r?.w != null ? px(r.w) : undefined,
    height: px(r?.h),
    borderRadius: r?.radius ?? undefined,
  };
}

// ── Drag-to-tile ───────────────────────────────────────────────────────────

function rectToLocal(r: DOMRect, origin: { x: number; y: number }): DndRect {
  return { x: r.left - origin.x, y: r.top - origin.y, w: r.width, h: r.height };
}

/** Clear hover state (pointer left the workspace or missed all tiles). */
function clearHover() {
  api.dnd.tileId = '';
  api.dnd.preview = null;
  api.dnd.glow = null;
  api.dnd.indicator = null;
}

/** Per-tile geometry for zone detection. */
interface TileGeom {
  id: string;
  rect: DOMRect;
  bandW: number;
  bandH: number;
  /** strip bottom + 6px tolerance — where the split bands start */
  contentTop: number;
  stripR: DOMRect | null;
  tabs: HTMLElement[];
  inStrip: boolean;
}

function tileGeom(id: string, el: HTMLElement, clientX: number, clientY: number): TileGeom {
  const rect = el.getBoundingClientRect();
  const bandW = Math.min(Math.max(rect.width * 0.25, 36), 72);
  const bandH = Math.min(Math.max(rect.height * 0.25, 28), 56);
  const strip = el.querySelector<HTMLElement>('.sf-tile-tabs');
  const stripR = strip?.getBoundingClientRect() ?? null;
  const tabs = strip ? [...strip.querySelectorAll<HTMLElement>('.sf-tab')] : [];
  const contentTop = (stripR ? stripR.bottom : rect.top) + 6; // inStrip tolerance
  const inStrip = !!stripR && stripR.height > 0 && clientY >= stripR.top - 6 && clientY <= stripR.bottom + 6;
  return { id, rect, bandW, bandH, contentTop, stripR, tabs, inStrip };
}

function onDragOver(e: DragEvent) {
  // Always prevent default: keeps drop allowed and stops the browser from
  // navigating when an OS file is dropped onto the workspace.
  e.preventDefault();
  if (!api.dnd.dragging) return;
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

  // One workspace rect per event; origin + corner detection share it.
  const wsRect = wsEl.value?.getBoundingClientRect() ?? null;
  const origin = { x: wsRect?.left ?? 0, y: wsRect?.top ?? 0 };
  const rightSeam = !!props.rightPanelVisible;
  const dnd = api.dnd;

  // Per-tile geometry for hit testing.
  const geoms: TileGeom[] = [];
  for (const [id, el] of api.tileEls) geoms.push(tileGeom(id, el, e.clientX, e.clientY));

  // Hit test: the tile under the cursor, then its zone. Edge bands decide
  // between split zones (left/right/top/bottom) and the move zone (center).
  const hit = geoms.find(
    (g) => e.clientX >= g.rect.left && e.clientX <= g.rect.right && e.clientY >= g.rect.top && e.clientY <= g.rect.bottom,
  );
  if (!hit) {
    clearHover();
    return;
  }

  const dx = e.clientX - hit.rect.left;
  const dy = e.clientY - hit.rect.top;
  const contentStart = hit.contentTop - hit.rect.top; // below the strip
  let zone: DropZone = 'center';
  if (hit.inStrip) {
    zone = 'center'; // The tab strip is the reorder zone (VSCode behavior).
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
    // Move zone: highlight the tile, and when over its tab strip compute
    // the insertion index + a reorder indicator between tabs.
    dnd.preview = null;
    const glow = rectToLocal(hit.rect, origin);
    if (wsRect) glow.radius = radiusStr(cornerPx(hit.rect, wsRect, rightSeam));
    dnd.glow = glow;
    const tile = api.findTileGlobal(hit.id);
    const tabCount = tile ? tile.tabs.length : 0;
    if (hit.inStrip && hit.stripR) {
      let idx = 0;
      for (const t of hit.tabs) {
        const tr = t.getBoundingClientRect();
        if (e.clientX > tr.left + tr.width / 2) idx += 1;
      }
      dnd.index = idx;
      const left = idx < hit.tabs.length ? hit.tabs[idx].getBoundingClientRect().left : hit.stripR.right - 1;
      dnd.indicator = { x: left - origin.x, y: hit.stripR.top - origin.y, h: hit.stripR.height };
    } else {
      // Over the content area: append.
      dnd.index = tabCount;
      dnd.indicator = null;
    }
  } else {
    // Split zones: preview the half of the tile the dragged tab will take.
    // The landing half is inset by half the gap on the seam side so the
    // box matches the final tile (which is separated by a sash).
    dnd.glow = null;
    dnd.indicator = null;
    dnd.index = 0;
    const r = hit.rect;
    const corners = wsRect ? cornerPx(r, wsRect, rightSeam) : ([0, 0, 0, 0] as [number, number, number, number]);
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
  if (!api.dnd.dragging) return;

  const { tabId, sourceTileId, tileId, zone, index, fromIndex } = api.dnd;
  api.endDrag();
  if (!tabId || !tileId) return;

  if (zone === 'center') {
    // Dropping a tab back where it came from is a no-op.
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
      <template v-for="(root, i) in api.roots" :key="root.id">
        <div class="sf-root-group" :style="{ flexBasis: root.ratio * 100 + '%' }">
          <WorkspaceNode :node="root.node" />
        </div>
        <RootSash v-if="i < api.roots.length - 1" :index="i" />
      </template>
    </div>

    <!-- Visual-only DnD layer (pointer-events: none — events go to the root) -->
    <div v-if="api.dnd.dragging" class="sf-dnd-layer">
      <div v-if="api.dnd.preview" class="sf-dnd-preview" :style="rectStyle(api.dnd.preview)" />
      <div v-if="api.dnd.glow && !api.dnd.preview" class="sf-dnd-glow" :style="rectStyle(api.dnd.glow)" />
      <div v-if="api.dnd.indicator" class="sf-dnd-indicator" :style="rectStyle(api.dnd.indicator)" />
    </div>
  </div>
</template>
