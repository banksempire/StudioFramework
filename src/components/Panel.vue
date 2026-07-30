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

/** How many tabs to show before the ☰ button. Updated by ResizeObserver. */
const visibleCount = ref(100);

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

/** Measure each tab's content width, compute how many fit. */
function recompute() {
  const tabs = getTabs();
  const n = tabs.length;
  if (n === 0) return;

  const row = tabsRow.value!;
  const containerW = row.clientWidth;
  const BTN_W = 28; // ☰ button width

  // Step 1: measure every tab at its natural content width
  for (const t of tabs) {
    t.style.flex = '0 0 auto';
    t.style.display = '';
  }

  const widths: number[] = [];
  for (const t of tabs) {
    widths.push(t.offsetWidth);
  }

  // Step 2: find how many consecutive tabs (from left) fit
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

  // At least 1 tab must be visible
  if (fit === 0) fit = 1;

  // Step 3: restore normal flex and apply visibility
  for (const t of tabs) {
    t.style.flex = '';
  }

  if (fit !== visibleCount.value) {
    visibleCount.value = fit;
  }

  for (let i = 0; i < n; i++) {
    tabs[i].style.display = i < fit ? '' : 'none';
  }
}

// ── ResizeObserver ────────────────────────────────────────────────────────

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

onMounted(() => {
  if (tabsRow.value) {
    observer = new ResizeObserver(() => scheduleRecompute());
    observer.observe(tabsRow.value);
  }
  nextTick(() => recompute());
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
