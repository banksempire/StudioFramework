<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { PanelAction, PanelSubSection } from '../types/panel';
import { readUiValue, writeUiValue } from '../uiState';
import SubSection from './SubSection.vue';

const props = withDefaults(
  defineProps<{
    subSections: PanelSubSection[];
    hiddenIds: Set<string>;
    stateKey?: string;
    mobile?: boolean;
  }>(),
  {
    stateKey: '',
    mobile: false,
  },
);

const emit = defineEmits<{
  utility: [subId: string, utilityId: string, itemId?: string];
  'component-action': [action: PanelAction];
}>();

const TITLE_BAR_H = 30;

const bodyEl = ref<HTMLElement | null>(null);
const bodyHeight = ref(0);
const ready = ref(false);

interface SubState {
  isExpanded: boolean;
  height: number;
  measuredHeight: number;
  savedHeight?: number;
}

const states = reactive<Record<string, SubState>>({});

interface PersistedSubState {
  expanded: boolean;
  height: number;
}

function subStateId(subId: string): string {
  return props.stateKey ? `${props.stateKey}::${subId}` : subId;
}

function readPersistedSub(subId: string): PersistedSubState | null {
  const v = readUiValue(`panel.sub.${subStateId(subId)}`);
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.expanded !== 'boolean') return null;
  const height = typeof r.height === 'number' && Number.isFinite(r.height) ? r.height : 0;
  return { expanded: r.expanded, height };
}

function persistSubState() {
  if (props.mobile || !props.stateKey) return;
  for (const sub of props.subSections) {
    const st = states[sub.id];
    if (!st) continue;
    writeUiValue(`panel.sub.${subStateId(sub.id)}`, {
      expanded: st.isExpanded,
      height: st.savedHeight ?? st.height,
    });
  }
}

const visibleSubSections = computed(() => props.subSections.filter((s) => !props.hiddenIds.has(s.id)));

const activeId = ref<string | null>(null);

function activate(id: string) {
  activeId.value = id;
}

watch(visibleSubSections, (subs) => {
  if (activeId.value && !subs.some((s) => s.id === activeId.value)) {
    activeId.value = null;
  }
});

function isResizeable(sub: PanelSubSection): boolean {
  if (props.mobile) return false;
  const st = states[sub.id];
  return !!st && st.isExpanded && !props.hiddenIds.has(sub.id) && sub.isHeightVariable;
}

function getBodyHeight(sub: PanelSubSection): number {
  const st = states[sub.id];
  if (!st?.isExpanded) return 0;
  if (!sub.isHeightVariable) return st.measuredHeight;
  return Math.max(st.height, sub.minHeight ?? 0);
}

function bodyHeightFor(sub: PanelSubSection): number | null {
  if (!sub.isHeightVariable || props.mobile) return null;
  const st = states[sub.id];
  if (!st?.isExpanded) return 0;
  return Math.max(st.height, sub.minHeight ?? 0);
}

function findSub(id: string): PanelSubSection {
  const sub = props.subSections.find((s) => s.id === id);
  if (!sub) throw new Error(`SubSectionBody: unknown subsection id ${id}`);
  return sub;
}

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
  const resizeable = visible.filter((s) => isResizeable(s));

  if (unallocated > 0 && resizeable.length > 0) {
    const first = resizeable[0];
    states[first.id].height = getBodyHeight(first) + unallocated;
  } else if (unallocated < 0) {
    squeezeToMin(
      resizeable.map((s) => s.id),
      -unallocated,
    );
  }
  persistSubState();
}

const fixedObservers = new Map<string, ResizeObserver>();

function measureAndObserve() {
  const body = bodyEl.value;
  if (!body) return;

  const wanted = new Set(
    props.subSections
      .filter((s) => !s.isHeightVariable && !props.hiddenIds.has(s.id) && states[s.id]?.isExpanded)
      .map((s) => s.id),
  );

  for (const [id, obs] of fixedObservers) {
    if (!wanted.has(id)) {
      obs.disconnect();
      fixedObservers.delete(id);
    }
  }

  for (const sub of props.subSections) {
    if (!wanted.has(sub.id)) continue;
    const el = body.querySelector(`[data-sub-body="${sub.id}"]`) as HTMLElement | null;
    if (!el) continue;
    const st = states[sub.id];
    st.measuredHeight = el.getBoundingClientRect().height;
    if (fixedObservers.has(sub.id)) continue;

    const obs = new ResizeObserver(() => {
      const s = states[sub.id];
      if (s?.isExpanded && el.isConnected) {
        s.measuredHeight = el.getBoundingClientRect().height;
        distributeHeight();
      }
    });
    obs.observe(el);
    fixedObservers.set(sub.id, obs);
  }
}

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

watch(
  () => props.subSections,
  (subs) => {
    const ids = new Set(subs.map((s) => s.id));
    for (const sub of subs) {
      if (!states[sub.id]) {
        const persisted = readPersistedSub(sub.id);
        const minHeight = sub.minHeight ?? 0;
        states[sub.id] = {
          isExpanded: persisted?.expanded ?? true,
          height: Math.max(persisted?.height ?? minHeight, minHeight),
          measuredHeight: 0,
        };
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
  },
  { immediate: true },
);

watch(
  () => props.hiddenIds,
  () => refresh(true),
);

watch(bodyHeight, () => refresh(false), { flush: 'sync' });

let bodyObserver: ResizeObserver | null = null;

onMounted(() => {
  const el = bodyEl.value;
  if (!el) return;
  bodyHeight.value = el.getBoundingClientRect().height;
  bodyObserver = new ResizeObserver(() => {
    bodyHeight.value = el.getBoundingClientRect().height;
  });
  bodyObserver.observe(el);
  requestAnimationFrame(() => refresh(false));
});

function toggleExpand(subId: string) {
  const st = states[subId];
  if (!st) return;
  const sub = props.subSections.find((s) => s.id === subId);
  if (!sub) return;

  if (st.isExpanded) {
    st.savedHeight = st.height;
    st.isExpanded = false;
  } else {
    st.isExpanded = true;
    const target = st.savedHeight ?? sub.minHeight ?? 0;
    const others = visibleSubSections.value.filter((s) => s.id !== subId && isResizeable(s)).map((s) => s.id);
    st.height = squeezeToMin(others, target);
  }
  persistSubState();
  refresh(true);
}

const handleFlags = computed(() => {
  const visible = visibleSubSections.value;
  const flags: boolean[] = [];
  let hasAbove = false;
  for (let i = 0; i < visible.length - 1; i++) {
    if (isResizeable(visible[i])) hasAbove = true;
    let hasBelow = false;
    for (let j = i + 1; j < visible.length; j++) {
      if (isResizeable(visible[j])) {
        hasBelow = true;
        break;
      }
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
  el: HTMLElement;
  pointerId: number;
}

let dragState: DragState | null = null;

function startDrag(index: number, e: PointerEvent) {
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

  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  dragState = { startY: e.clientY, aboveIds, belowIds, startHeights, el, pointerId: e.pointerId };
  document.body.classList.add('sf-dragging');
  document.body.style.userSelect = 'none';
}

function onDragMove(e: PointerEvent) {
  if (!dragState) return;
  const delta = e.clientY - dragState.startY;

  if (delta < 0) {
    const freed = squeezeToMin([...dragState.aboveIds].reverse(), Math.abs(delta), dragState.startHeights);
    const firstBelow = dragState.belowIds[0];
    states[firstBelow].height = dragState.startHeights[firstBelow] + freed;
  } else if (delta > 0) {
    const freed = squeezeToMin(dragState.belowIds, delta, dragState.startHeights);
    const lastAbove = dragState.aboveIds[dragState.aboveIds.length - 1];
    states[lastAbove].height = dragState.startHeights[lastAbove] + freed;
  }
}

function onDragEnd() {
  if (!dragState) return;
  dragState.el.releasePointerCapture(dragState.pointerId);
  dragState = null;
  document.body.classList.remove('sf-dragging');
  document.body.style.userSelect = '';
  persistSubState();
}

onUnmounted(() => {
  bodyObserver?.disconnect();
  fixedObservers.forEach((o) => {
    o.disconnect();
  });
  fixedObservers.clear();
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
        @utility="(utilityId, itemId) => emit('utility', sub.id, utilityId, itemId)"
        @content-changed="refresh(true)"
        @component-action="(a) => emit('component-action', a)"
      />
      <div
        v-if="i < visibleSubSections.length - 1 && handleFlags[i]"
        class="sf-subsection-drag-wrapper"
      >
        <div
          class="sf-subsection-drag-handle"
          @pointerdown="startDrag(i, $event)"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        />
      </div>
    </template>
  </div>
</template>
