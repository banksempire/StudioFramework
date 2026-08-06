<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { PanelAction, PanelSubSection } from '../types/panel';
import SubSection from './SubSection.vue';

const props = defineProps<{
  subSections: PanelSubSection[];
  hiddenIds: Set<string>;
}>();

const emit = defineEmits<{
  utility: [subId: string, utilityId: string];
  'component-action': [action: PanelAction];
}>();

const TITLE_BAR_H = 24;

// ── State ──────────────────────────────────────────────────────────────────

const bodyEl = ref<HTMLElement | null>(null);
/** Height of the sub-section container, FRACTIONAL-exact (getBoundingClientRect,
 *  not clientHeight which rounds). At non-100% browser/display zoom the layout
 *  viewport is fractional; distributing to a rounded height makes the panel's
 *  scroll container overflow by <1px and show a spurious scrollbar. */
const bodyHeight = ref(0);
const ready = ref(false);

interface SubState {
  isExpanded: boolean;
  height: number;          // variable: current ComponentBody height
  measuredHeight: number;  // fixed: measured from DOM
  savedHeight?: number;    // saved when collapsed, restored on expand
}

const states = reactive<Record<string, SubState>>({});

const visibleSubSections = computed(() =>
  props.subSections.filter(s => !props.hiddenIds.has(s.id)),
);

/** Currently active sub-section id (null = none). Only one active at a time. */
const activeId = ref<string | null>(null);

function activate(id: string) {
  activeId.value = id;
}

// Clear active when the active sub-section is hidden or removed
watch(visibleSubSections, (subs) => {
  if (activeId.value && !subs.some(s => s.id === activeId.value)) {
    activeId.value = null;
  }
});

function isResizeable(sub: PanelSubSection): boolean {
  const st = states[sub.id];
  return !!st && st.isExpanded && !props.hiddenIds.has(sub.id) && sub.isHeightVariable;
}

function getBodyHeight(sub: PanelSubSection): number {
  const st = states[sub.id];
  if (!st || !st.isExpanded) return 0;
  if (!sub.isHeightVariable) return st.measuredHeight;
  return Math.max(st.height, sub.minHeight ?? 0);
}

/** What to pass as bodyHeight prop to SubSection (null = auto). */
function bodyHeightFor(sub: PanelSubSection): number | null {
  if (!sub.isHeightVariable) return null;
  const st = states[sub.id];
  if (!st?.isExpanded) return 0;
  return Math.max(st.height, sub.minHeight ?? 0);
}

// ── Height distribution ────────────────────────────────────────────────────

function findSub(id: string): PanelSubSection {
  return props.subSections.find(s => s.id === id)!;
}

/**
 * Reduce the given sub-sections toward their minHeight (top→bottom order).
 * `heights` is the source of heights (live states, or a drag snapshot).
 * Returns the total px freed.
 */
function squeezeToMin(ids: string[], needed: number, heights?: Record<string, number>): number {
  let freed = 0;
  for (const id of ids) {
    if (freed >= needed) break;
    const start = heights ? heights[id] : states[id].height;
    const canGive = start - (findSub(id).minHeight ?? 0);
    if (canGive <= 0) continue;
    const give = Math.min(canGive, needed - freed);
    states[id].height = start - give;
    freed += give;
  }
  return freed;
}

function distributeHeight() {
  if (bodyHeight.value === 0) return;
  const visible = visibleSubSections.value;
  if (visible.length === 0) return;

  let used = 0;
  for (const sub of visible) {
    used += TITLE_BAR_H;
    used += getBodyHeight(sub);
  }
  const unallocated = bodyHeight.value - used;
  const resizeable = visible.filter(s => isResizeable(s));

  if (unallocated > 0 && resizeable.length > 0) {
    // Give all surplus to the first resizeable sub-section. The fill is
    // based on the RENDERED body height (getBodyHeight never dips below the
    // minHeight floor): a freshly-expanded sub-section can start below its
    // min (expand sets height = squeeze result), and adding raw surplus to
    // that would double-count the floor and leave a gap at the panel bottom.
    const first = resizeable[0];
    states[first.id].height = getBodyHeight(first) + unallocated;
  } else if (unallocated < 0) {
    // Squeeze resizeable sub-sections top-to-bottom
    squeezeToMin(resizeable.map(s => s.id), -unallocated);
  }
}

// ── Measure fixed sub-sections + set up observers (incremental) ────────────
// Fixed sub-section bodies are keyed stably by id, so their observers are
// created once and only dropped when the sub-section leaves the observed
// set — no disconnect/re-create churn on every refresh.

const fixedObservers = new Map<string, ResizeObserver>();

function measureAndObserve() {
  const body = bodyEl.value;
  if (!body) return;

  // The set of fixed sub-sections that should be observed right now.
  const wanted = new Set(
    props.subSections
      .filter(s => !s.isHeightVariable && !props.hiddenIds.has(s.id) && states[s.id]?.isExpanded)
      .map(s => s.id),
  );

  // Drop observers for sub-sections no longer in the set.
  for (const [id, obs] of fixedObservers) {
    if (!wanted.has(id)) {
      obs.disconnect();
      fixedObservers.delete(id);
    }
  }

  // Refresh measurements; create observers only for missing sub-sections.
  for (const sub of props.subSections) {
    if (!wanted.has(sub.id)) continue;
    const el = body.querySelector(`[data-sub-body="${sub.id}"]`) as HTMLElement | null;
    if (!el) continue;
    const st = states[sub.id];
    st.measuredHeight = el.getBoundingClientRect().height;
    if (fixedObservers.has(sub.id)) continue;

    const obs = new ResizeObserver(() => {
      const s = states[sub.id];
      if (s && s.isExpanded && el.isConnected) {
        s.measuredHeight = el.getBoundingClientRect().height;
        distributeHeight();
      }
    });
    obs.observe(el);
    fixedObservers.set(sub.id, obs);
  }
}

// ── Refresh: measure + distribute ───────────────────────────────────────────

function refresh(defer = false) {
  const run = () => {
    if (bodyHeight.value === 0) return;
    measureAndObserve();
    distributeHeight();
    ready.value = true;
  };
  if (defer) nextTick(run);
  else run();
}

// ── React to changes ───────────────────────────────────────────────────────

// Sub-sections change: manage states + refresh (deferred - DOM needs update)
watch(() => props.subSections, (subs) => {
  const ids = new Set(subs.map(s => s.id));
  for (const sub of subs) {
    if (!states[sub.id]) {
      states[sub.id] = { isExpanded: true, height: sub.minHeight ?? 0, measuredHeight: 0 };
    }
  }
  for (const key of Object.keys(states)) {
    if (!ids.has(key)) {
      delete states[key];
      fixedObservers.get(key)?.disconnect();
      fixedObservers.delete(key);
    }
  }
  refresh(true);
}, { immediate: true });

// Visibility change: refresh (deferred)
watch(() => props.hiddenIds, () => refresh(true));

// Body height change: refresh (immediate - DOM already correct)
watch(bodyHeight, () => refresh(false), { flush: 'sync' });

// ── Body ResizeObserver ────────────────────────────────────────────────────

let bodyObserver: ResizeObserver | null = null;

onMounted(() => {
  const el = bodyEl.value;
  if (!el) return;
  bodyHeight.value = el.getBoundingClientRect().height;  // triggers watch -> refresh(false)
  bodyObserver = new ResizeObserver(() => {
    bodyHeight.value = el.getBoundingClientRect().height;
  });
  bodyObserver.observe(el);
  requestAnimationFrame(() => refresh(false));  // safety net
});

// ── Expand / collapse ──────────────────────────────────────────────────────

function toggleExpand(subId: string) {
  const st = states[subId];
  if (!st) return;
  const sub = props.subSections.find(s => s.id === subId)!;

  if (st.isExpanded) {
    // Collapsing: save height for later restore
    st.savedHeight = st.height;
    st.isExpanded = false;
  } else {
    // Expanding: restore height, take space back from other resizeable sub-sections
    st.isExpanded = true;
    const target = st.savedHeight ?? sub.minHeight ?? 0;
    const others = visibleSubSections.value
      .filter(s => s.id !== subId && isResizeable(s))
      .map(s => s.id);
    st.height = squeezeToMin(others, target);  // might not get full amount if others at min
  }
  refresh(true);
}

// ── Drag handles ───────────────────────────────────────────────────────────

/** Per-boundary flag: can this handle redistribute space? (resizeable above AND below) */
const handleFlags = computed(() => {
  const visible = visibleSubSections.value;
  const flags: boolean[] = [];
  let hasAbove = false;
  for (let i = 0; i < visible.length - 1; i++) {
    if (isResizeable(visible[i])) hasAbove = true;
    let hasBelow = false;
    for (let j = i + 1; j < visible.length; j++) {
      if (isResizeable(visible[j])) { hasBelow = true; break; }
    }
    flags.push(hasAbove && hasBelow);
  }
  return flags;
});

interface DragState {
  startY: number;
  aboveIds: string[];
  belowIds: string[];
  startHeights: Record<string, number>;
}

let dragState: DragState | null = null;

function startDrag(index: number, e: MouseEvent) {
  e.preventDefault();
  const visible = visibleSubSections.value;
  const aboveIds: string[] = [];
  const belowIds: string[] = [];

  for (let i = 0; i <= index; i++) {
    if (isResizeable(visible[i])) aboveIds.push(visible[i].id);
  }
  for (let i = index + 1; i < visible.length; i++) {
    if (isResizeable(visible[i])) belowIds.push(visible[i].id);
  }
  if (!aboveIds.length || !belowIds.length) return;

  const startHeights: Record<string, number> = {};
  for (const id of [...aboveIds, ...belowIds]) {
    startHeights[id] = states[id].height;
  }

  dragState = { startY: e.clientY, aboveIds, belowIds, startHeights };
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
  document.body.classList.add('sf-dragging');
  document.body.style.userSelect = 'none';
}

function onDragMove(e: MouseEvent) {
  if (!dragState) return;
  const delta = e.clientY - dragState.startY;

  if (delta < 0) {
    // Drag up: squeeze above (bottom→top), give to first below
    const freed = squeezeToMin([...dragState.aboveIds].reverse(), Math.abs(delta), dragState.startHeights);
    const firstBelow = dragState.belowIds[0];
    states[firstBelow].height = dragState.startHeights[firstBelow] + freed;

  } else if (delta > 0) {
    // Drag down: squeeze below (top→bottom), give to last above
    const freed = squeezeToMin(dragState.belowIds, delta, dragState.startHeights);
    const lastAbove = dragState.aboveIds[dragState.aboveIds.length - 1];
    states[lastAbove].height = dragState.startHeights[lastAbove] + freed;
  }
}

function onDragEnd() {
  dragState = null;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  document.body.classList.remove('sf-dragging');
  document.body.style.userSelect = '';
}

// ── Cleanup ────────────────────────────────────────────────────────────────

onUnmounted(() => {
  bodyObserver?.disconnect();
  fixedObservers.forEach(o => o.disconnect());
  fixedObservers.clear();
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
});
</script>

<template>
  <div ref="bodyEl" class="sf-subsection-body-container" :style="{ overflowY: ready ? 'auto' : 'hidden' }">
    <template v-for="(sub, i) in visibleSubSections" :key="sub.id">
      <SubSection
        :sub-section="sub"
        :is-expanded="states[sub.id]?.isExpanded ?? true"
        :is-active="activeId === sub.id"
        :body-height="bodyHeightFor(sub)"
        @toggle-expand="toggleExpand(sub.id)"
        @activate="activate(sub.id)"
        @utility="emit('utility', sub.id, $event)"
        @content-changed="refresh(true)"
        @component-action="(a) => emit('component-action', a)"
      />
      <div
        v-if="i < visibleSubSections.length - 1 && handleFlags[i]"
        class="sf-subsection-drag-wrapper"
      >
        <div
          class="sf-subsection-drag-handle"
          @mousedown="startDrag(i, $event)"
        />
      </div>
    </template>
  </div>
</template>
