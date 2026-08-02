<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick } from 'vue';
import { useResize } from '../composables/useResize';
import { useClickOutside } from '../composables/useClickOutside';
import type { PanelSection } from '../types/panel';
import SubsectionBody from './SubsectionBody.vue';

const props = withDefaults(defineProps<{
  title: string;
  visible: boolean;
  position: 'left' | 'right';
  sections?: PanelSection[];
}>(), {
  visible: true,
  sections: () => [],
});

const emit = defineEmits<{
  collapse: [];
  'select-section': [sectionId: string];
}>();

// ── Resize ────────────────────────────────────────────────────────────────

const resizeDir = computed(() => props.position === 'left' ? 'right' : 'left');
const oppositeEdge = computed(() => props.position === 'left' ? 'left' : 'right');

const MIN_WIDTH = 150;
const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: MIN_WIDTH,
  max: 500,
  direction: resizeDir.value,
  collapseThreshold: Math.round(MIN_WIDTH * 2 / 3),
  onCollapse: () => emit('collapse'),
});

// ── Section tabs ──────────────────────────────────────────────────────────

const activeIndex = ref(0);
const overflowOpen = ref(false);
useClickOutside(overflowOpen, '.sf-panel-tabs-wrapper');
const tabsRow = ref<HTMLElement | null>(null);

const visibleCount = ref(100);

const hasOverflow = computed(() =>
  props.sections.length > 1 && visibleCount.value < props.sections.length,
);

const overflowTabs = computed(() => props.sections.slice(visibleCount.value));

const savedIndex = new Map<string, number>();
let lastKey = '';

function panelKey(sections: PanelSection[]) {
  return sections.map(s => s.id).join('|');
}

lastKey = panelKey(props.sections);

watch(() => props.sections, (sections, old) => {
  if (lastKey) savedIndex.set(lastKey, activeIndex.value);
  lastKey = panelKey(sections);
  activeIndex.value = savedIndex.get(lastKey) ?? 0;
  visibleCount.value = 100;
  overflowOpen.value = false;
  visibilityMenuOpen.value = false;
  nextTick(() => recompute());
});

function selectSection(idx: number) {
  activeIndex.value = idx;
  emit('select-section', props.sections[idx].id);
}

function selectOverflowSection(sectionId: string) {
  const i = props.sections.findIndex(s => s.id === sectionId);
  if (i >= 0) selectSection(i);
  overflowOpen.value = false;
}

// ── Overflow detection ────────────────────────────────────────────────────

function getTabs(): HTMLElement[] {
  if (!tabsRow.value) return [];
  return Array.from(
    tabsRow.value.querySelectorAll<HTMLElement>(
      '.sf-panel-tab:not(.sf-panel-tab--overflow)',
    ),
  );
}

function recompute() {
  const tabs = getTabs();
  const n = tabs.length;
  if (n === 0) return;

  const row = tabsRow.value!;
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
  requestAnimationFrame(() => { pending = false; recompute(); });
}

watch(tabsRow, (el) => {
  observer?.disconnect();
  observer = null;
  if (el) {
    observer = new ResizeObserver(() => scheduleRecompute());
    observer.observe(el);
    nextTick(() => recompute());
  }
}, { immediate: true });

// ── Sub-section visibility ─────────────────────────────────────────────────

const visibilityMenuOpen = ref(false);
useClickOutside(visibilityMenuOpen, ['.sf-panel-header-btn', '.sf-panel-visibility-dropdown']);
const hiddenSubSections = ref<Map<string, Set<string>>>(new Map());

const activeSection = computed(() =>
  props.sections.length > 0 ? props.sections[activeIndex.value] : null,
);
const activeSectionId = computed(() => activeSection.value?.id ?? '');
const activeSubSections = computed(() => activeSection.value?.subSections ?? []);
const hasSubSections = computed(() => activeSubSections.value.length > 0);

const activeHiddenIds = computed(() => {
  const sec = activeSection.value;
  if (!sec) return new Set<string>();
  return new Set(hiddenSubSections.value.get(lastKey + '::' + sec.id) ?? []);
});

function toggleSubVisible(subId: string) {
  const sec = activeSection.value;
  if (!sec) return;
  const key = lastKey + '::' + sec.id;
  let hidden = new Set(hiddenSubSections.value.get(key) ?? []);
  if (hidden.has(subId)) hidden.delete(subId);
  else hidden.add(subId);
  hiddenSubSections.value.set(key, hidden);
  hiddenSubSections.value = new Map(hiddenSubSections.value);
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
      <button
        v-if="hasSubSections"
        class="sf-panel-header-btn"
        @click.stop="visibilityMenuOpen = !visibilityMenuOpen"
      >⋯</button>

      <!-- Visibility dropdown -->
      <div v-if="visibilityMenuOpen && hasSubSections" class="sf-panel-visibility-dropdown">
        <button
          v-for="sub in activeSubSections"
          :key="sub.id"
          class="sf-panel-visibility-item"
          @click="toggleSubVisible(sub.id)"
        >
          <span class="sf-panel-visibility-check">{{ activeHiddenIds.has(sub.id) ? '' : '✓' }}</span>
          {{ sub.label }}
        </button>
      </div>
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

        <button
          v-if="hasOverflow"
          class="sf-panel-tab sf-panel-tab--overflow"
          :class="{ 'sf-panel-tab--active': activeIndex >= visibleCount }"
          @click.stop="overflowOpen = !overflowOpen"
        >☰</button>
      </div>

      <div v-if="overflowOpen && hasOverflow" class="sf-panel-tabs-dropdown">
        <button
          v-for="sec in overflowTabs"
          :key="sec.id"
          class="sf-panel-tabs-dropdown-item"
          :class="{ 'sf-panel-tabs-dropdown-item--active': sections.indexOf(sec) === activeIndex }"
          @click="selectOverflowSection(sec.id)"
        >{{ sec.label }}</button>
      </div>
    </div>

    <!-- Sub-section body -->
    <SubsectionBody
      v-if="hasSubSections"
      :key="activeSectionId"
      :sub-sections="activeSubSections"
      :hidden-ids="activeHiddenIds"
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
