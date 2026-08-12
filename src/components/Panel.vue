<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useResize } from '../composables/useResize';
import type { MenuNodeDef } from '../types/layout';
import type { PanelAction, PanelSection } from '../types/panel';
import Menu from './Menu.vue';
import SubsectionBody from './SubsectionBody.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    visible: boolean;
    position: 'left' | 'right';
    sections?: PanelSection[];
  }>(),
  {
    visible: true,
    sections: () => [],
  },
);

const emit = defineEmits<{
  collapse: [];
  'select-section': [sectionId: string];
  resize: [width: number];
  utility: [subId: string, utilityId: string];
  'component-action': [action: PanelAction];
}>();

// ── Resize ────────────────────────────────────────────────────────────────

const resizeDir = computed(() => (props.position === 'left' ? 'right' : 'left'));
const oppositeEdge = computed(() => (props.position === 'left' ? 'left' : 'right'));

const MIN_WIDTH = 150;
const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: MIN_WIDTH,
  max: 500,
  direction: resizeDir.value,
  collapseThreshold: Math.round((MIN_WIDTH * 2) / 3),
  onCollapse: () => emit('collapse'),
  onResize: (w: number) => emit('resize', w),
});

// ── Section tabs ──────────────────────────────────────────────────────────

const activeIndex = ref(0);
const overflowOpen = ref(false);
const tabsRow = ref<HTMLElement | null>(null);

const visibleCount = ref(100);

const hasOverflow = computed(() => props.sections.length > 1 && visibleCount.value < props.sections.length);

const overflowTabs = computed(() => props.sections.slice(visibleCount.value));

const savedIndex = new Map<string, number>();
let lastKey = '';

function panelKey(sections: PanelSection[]) {
  return sections.map((s) => s.id).join('|');
}

lastKey = panelKey(props.sections);

watch(
  () => props.sections,
  (sections, _old) => {
    if (lastKey) savedIndex.set(lastKey, activeIndex.value);
    lastKey = panelKey(sections);
    activeIndex.value = savedIndex.get(lastKey) ?? 0;
    visibleCount.value = 100;
    overflowOpen.value = false;
    visibilityMenuOpen.value = false;
    nextTick(() => recompute());
  },
);

function selectSection(idx: number) {
  activeIndex.value = idx;
  emit('select-section', props.sections[idx].id);
}

function selectOverflowSection(sectionId: string) {
  const i = props.sections.findIndex((s) => s.id === sectionId);
  if (i >= 0) selectSection(i);
  overflowOpen.value = false;
}

// ── Overflow detection ────────────────────────────────────────────────────

function getTabs(): HTMLElement[] {
  if (!tabsRow.value) return [];
  return Array.from(
    tabsRow.value.querySelectorAll<HTMLElement>('.sf-panel-tab:not(.sf-panel-tab--overflow)'),
  );
}

function recompute() {
  const tabs = getTabs();
  const n = tabs.length;
  if (n === 0) return;

  const row = tabsRow.value;
  if (!row) return;
  const containerW = row.clientWidth;
  const BTN_W = 28;

  for (const t of tabs) {
    t.style.flex = '0 0 auto';
    t.style.display = '';
  }

  const widths: number[] = [];
  for (const t of tabs) widths.push(t.offsetWidth);

  let used = 0;
  let fit = n;
  for (let i = 0; i < n; i++) {
    const need = used + widths[i] + (i < n - 1 ? BTN_W : 0);
    if (need <= containerW) {
      used += widths[i];
    } else {
      fit = i;
      break;
    }
  }
  if (fit === 0) fit = 1;

  for (const t of tabs) t.style.flex = '';

  if (fit !== visibleCount.value) visibleCount.value = fit;

  for (let i = 0; i < n; i++) {
    tabs[i].style.display = i < fit ? '' : 'none';
  }
}

let observer: ResizeObserver | null = null;
let pending = false;

function scheduleRecompute() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    recompute();
  });
}

watch(
  tabsRow,
  (el) => {
    observer?.disconnect();
    observer = null;
    if (el) {
      observer = new ResizeObserver(() => scheduleRecompute());
      observer.observe(el);
      nextTick(() => recompute());
    }
  },
  { immediate: true },
);

// ── Sub-section visibility ─────────────────────────────────────────────────

const visibilityMenuOpen = ref(false);
const hiddenSubSections = ref<Map<string, Set<string>>>(new Map());

const activeSection = computed(() => (props.sections.length > 0 ? props.sections[activeIndex.value] : null));
const activeSectionId = computed(() => activeSection.value?.id ?? '');
const activeSubSections = computed(() => activeSection.value?.subSections ?? []);
const hasSubSections = computed(() => activeSubSections.value.length > 0);

const activeHiddenIds = computed(() => {
  const sec = activeSection.value;
  if (!sec) return new Set<string>();
  return new Set(hiddenSubSections.value.get(`${lastKey}::${sec.id}`) ?? []);
});

function toggleSubVisible(subId: string) {
  const sec = activeSection.value;
  if (!sec) return;
  const key = `${lastKey}::${sec.id}`;
  let hidden = new Set(hiddenSubSections.value.get(key) ?? []);
  if (hidden.has(subId)) hidden.delete(subId);
  else hidden.add(subId);
  hiddenSubSections.value.set(key, hidden);
  hiddenSubSections.value = new Map(hiddenSubSections.value);
}

// Unified-menu item lists: the visibility ⋯ menu (multi-select checks) and
// the section-tabs overflow menu (single-select dots).
const visibilityItems = computed<MenuNodeDef[]>(() =>
  activeSubSections.value.map((sub) => ({
    id: sub.id,
    label: sub.label,
    iconKind: 'check' as const,
    selected: !activeHiddenIds.value.has(sub.id),
  })),
);

const overflowItems = computed<MenuNodeDef[]>(() =>
  overflowTabs.value.map((sec) => ({
    id: sec.id,
    label: sec.label,
    iconKind: 'dot' as const,
    selected: sectionsIndexOf(sec) === activeIndex.value,
  })),
);

function sectionsIndexOf(sec: PanelSection) {
  return props.sections.indexOf(sec);
}

// ── Cleanup ────────────────────────────────────────────────────────────────

onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div
    class="sf-panel"
    :class="[
      'sf-panel--' + position,
      {
        'sf-panel--dragging': dragging,
        'sf-panel--will-collapse': willCollapse,
        'sf-panel--hidden': !visible,
      },
    ]"
    :style="{ width: width + 'px' }"
  >
    <div
      class="sf-panel-resize-handle"
      :class="'sf-panel-resize-handle--' + resizeDir"
      @mousedown="onMouseDown"
    />

    <!-- Title bar -->
    <div class="sf-panel-header">
      <span class="sf-panel-title">{{ title }}</span>
      <Menu
        :items="visibilityItems"
        :open="visibilityMenuOpen"
        :close-on-select="false"
        @update:open="(v) => (visibilityMenuOpen = v)"
        @select="(item) => item.id && toggleSubVisible(item.id)"
      >
        <template #trigger="{ toggle }">
          <button
            v-if="hasSubSections"
            class="sf-panel-header-btn"
            @click.stop="toggle"
          >⋯</button>
        </template>
      </Menu>
    </div>

    <!-- Section tab bar - only when multiple sections -->
    <div v-if="sections.length > 1" class="sf-panel-tabs-wrapper">
      <div ref="tabsRow" class="sf-panel-tabs">
        <button
          v-for="(sec, i) in sections"
          :key="sec.id"
          class="sf-panel-tab"
          :class="{ 'sf-panel-tab--active': i === activeIndex }"
          @click="selectSection(i)"
        >{{ sec.label }}</button>

        <Menu
          :items="overflowItems"
          :open="overflowOpen"
          @update:open="(v) => (overflowOpen = v)"
          @select="(item) => item.id && selectOverflowSection(item.id)"
        >
          <template #trigger="{ toggle }">
            <button
              v-if="hasOverflow"
              class="sf-panel-tab sf-panel-tab--overflow"
              :class="{ 'sf-panel-tab--active': activeIndex >= visibleCount }"
              @click.stop="toggle"
            >☰</button>
          </template>
        </Menu>
      </div>
    </div>

    <!-- Sub-section body -->
    <SubsectionBody
      v-if="hasSubSections"
      :key="activeSectionId"
      :sub-sections="activeSubSections"
      :hidden-ids="activeHiddenIds"
      @utility="(subId, utilityId) => emit('utility', subId, utilityId)"
      @component-action="(a) => emit('component-action', a)"
    />
    <div v-else class="sf-panel-empty" />

    <!-- DTC glow overlay - renders above all content -->
    <div
      v-if="willCollapse"
      class="sf-panel-dtc-overlay"
      :class="'sf-panel-dtc-overlay--' + oppositeEdge"
    />
  </div>
</template>
