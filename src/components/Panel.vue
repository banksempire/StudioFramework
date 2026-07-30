<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useResize } from '../composables/useResize.js';

export interface PanelSection {
  id: string;
  label: string;
}

const props = withDefaults(defineProps<{
  title: string;
  visible: boolean;
  position: 'left' | 'right';
  sections?: PanelSection[];
  activeSection?: string;
}>(), {
  visible: true,
  sections: () => [],
});

const emit = defineEmits<{
  'collapse': [];
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
const tabsRow = ref<HTMLElement | null>(null);
const visibleCount = ref(100); // all visible initially

const hasOverflow = computed(() =>
  props.sections.length > 1 && visibleCount.value < props.sections.length,
);

const overflowTabs = computed(() => props.sections.slice(visibleCount.value));

watch(() => props.activeSection, (val) => {
  if (val) {
    const i = props.sections.findIndex(s => s.id === val);
    if (i >= 0) activeIndex.value = i;
  }
}, { immediate: true });

// Click handlers
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
    tabsRow.value.querySelectorAll<HTMLElement>('.sf-panel-tab:not(.sf-panel-tab--overflow)'),
  );
}

let observer: ResizeObserver | null = null;

function recalc() {
  const tabs = getTabs();
  if (tabs.length === 0 || props.sections.length <= 1) {
    visibleCount.value = props.sections.length;
    return;
  }
  const row = tabsRow.value!;

  // Temporarily show all tabs
  for (const t of tabs) t.style.display = '';

  const overflows = row.scrollWidth > row.clientWidth;
  if (!overflows) {
    visibleCount.value = props.sections.length;
    syncDisplay();
    return;
  }

  // Binary search for max count that fits (reserving room for ☰ button)
  let lo = 1;
  let hi = props.sections.length;

  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].style.display = i < mid ? '' : 'none';
    }
    if (row.scrollWidth > row.clientWidth) {
      hi = mid - 1;
    } else {
      lo = mid;
    }
  }

  visibleCount.value = Math.max(1, lo);
  syncDisplay();
}

function syncDisplay() {
  const tabs = getTabs();
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].style.display = i < visibleCount.value ? '' : 'none';
  }
}

onMounted(() => {
  if (tabsRow.value) {
    observer = new ResizeObserver(() => recalc());
    observer.observe(tabsRow.value);
  }
  nextTick(() => recalc());
});

onUnmounted(() => {
  observer?.disconnect();
  document.removeEventListener('click', onClickOutside);
});

// ── Close overflow menu on outside click ──────────────────────────────────

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.sf-panel-tabs-wrapper')) {
    overflowOpen.value = false;
  }
}

watch(overflowOpen, (val) => {
  if (val) {
    // Use setTimeout to avoid the same click that opened it from closing it
    setTimeout(() => document.addEventListener('click', onClickOutside), 0);
  } else {
    document.removeEventListener('click', onClickOutside);
  }
});
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
    :data-collapse-edge="willCollapse ? oppositeEdge : undefined"
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
    </div>

    <!-- Section tab bar — only when multiple sections -->
    <div v-if="sections.length > 1" class="sf-panel-tabs-wrapper">
      <div ref="tabsRow" class="sf-panel-tabs">
        <button
          v-for="(sec, i) in sections"
          :key="sec.id"
          class="sf-panel-tab"
          :class="{ 'sf-panel-tab--active': i === activeIndex }"
          @click="selectSection(i)"
        >
          {{ sec.label }}
        </button>

        <button
          v-if="hasOverflow"
          class="sf-panel-tab sf-panel-tab--overflow"
          :class="{ 'sf-panel-tab--active': activeIndex >= visibleCount }"
          @click.stop="overflowOpen = !overflowOpen"
        >
          ☰
        </button>
      </div>

      <div
        v-if="overflowOpen && hasOverflow"
        class="sf-panel-tabs-dropdown"
      >
        <button
          v-for="sec in overflowTabs"
          :key="sec.id"
          class="sf-panel-tabs-dropdown-item"
          :class="{ 'sf-panel-tabs-dropdown-item--active': sections.indexOf(sec) === activeIndex }"
          @click="selectOverflowSection(sec.id)"
        >
          {{ sec.label }}
        </button>
      </div>
    </div>

    <!-- DTC glow overlay — renders above all content -->
    <div
      v-if="willCollapse"
      class="sf-panel-dtc-overlay"
      :class="'sf-panel-dtc-overlay--' + oppositeEdge"
    />
  </div>
</template>
