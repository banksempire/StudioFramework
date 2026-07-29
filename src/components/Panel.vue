<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import type { PanelPayload } from '../types/panel.js';
import { useResize } from '../composables/useResize.js';
import PanelSubSection from './PanelSubSection.vue';

const props = defineProps<{
  payload: PanelPayload;
  visible: boolean;
  position: 'left' | 'right';
}>();

const emit = defineEmits<{
  'collapse': [];
  'action': [subsectionId: string, actionId: string];
  'component-change': [componentId: string, value: unknown];
}>();

// ── Horizontal panel-edge resize ──────────────────────────────────────────

const resizeDir = computed(() => props.position === 'left' ? 'right' : 'left');
const oppositeEdge = computed(() => props.position === 'left' ? 'left' : 'right');

const { width, dragging, willCollapse, onMouseDown: onPanelResize } = useResize({
  min: 180,
  max: 500,
  direction: resizeDir.value,
  onCollapse: () => emit('collapse'),
});

// ── Section tabs ──────────────────────────────────────────────────────────

const showTabs = computed(() => props.payload.sections.length > 1);
const activeSectionIndex = ref(0);
const activeSection = computed(() =>
  props.payload.sections[activeSectionIndex.value] ?? { id: '', label: '', subSections: [] },
);

// ── ⋯ overflow for section tabs ────────────────────────────────────────

const overflowOpen = ref(false);
const tabOverflow = ref<{ label: string; index: number }[]>([]);
const tabsRef = ref<HTMLElement | null>(null);

// Simplified: show overflow if sections > 5 (can be refined with ResizeObserver)
const visibleTabCount = computed(() => activeSection.value.subSections.length > 5 ? 5 : props.payload.sections.length);
const hasOverflow = computed(() => props.payload.sections.length > visibleTabCount.value);

// ── Title bar ⋯ menu (sub-section visibility) ────────────────────────────

const titleMenuOpen = ref(false);

// Collect all sub-sections across all sections for the visibility menu
const allSubSections = computed(() => {
  const result: { sectionLabel: string; id: string; displayName: string }[] = [];
  for (const sec of props.payload.sections) {
    for (const sub of sec.subSections) {
      result.push({ sectionLabel: sec.label, id: sub.id, displayName: sub.displayName });
    }
  }
  return result;
});

const hiddenSubsections = reactive<Set<string>>(new Set());
const collapsedIds = reactive<Set<string>>(new Set());

function toggleSubSectionVisibility(id: string) {
  if (hiddenSubsections.has(id)) {
    hiddenSubsections.delete(id);
  } else {
    hiddenSubsections.add(id);
  }
}

function onToggleCollapse(subId: string, collapsed: boolean) {
  if (collapsed) {
    collapsedIds.add(subId);
  } else {
    collapsedIds.delete(subId);
  }
}

// ── Sub-section heights (vertical resize) ─────────────────────────────────

const subSectionHeights = reactive<Record<string, number | null>>({});

// Initialize heights & reset tab index on payload change
watch(() => props.payload, () => {
  activeSectionIndex.value = 0;
  for (const key of Object.keys(subSectionHeights)) {
    delete subSectionHeights[key];
  }
}, { immediate: true });

function getHeight(key: string): number | null {
  return key in subSectionHeights ? subSectionHeights[key] : null;
}

// Track which sub-sections are expanded for "isLast" calculation
function expandedSubs(): string[] {
  return activeSection.value.subSections
    .filter(s => !hiddenSubsections.has(s.id) && !collapsedIds.has(s.id))
    .map(s => s.id);
}

function isLastExpanded(subId: string): boolean {
  const expanded = expandedSubs();
  return expanded.length > 0 && expanded[expanded.length - 1] === subId;
}

// Handle vertical resize: delta applies to this sub-section and inverse to next
function onSubSectionResize(subId: string, delta: number) {
  const ids = expandedSubs();
  const idx = ids.indexOf(subId);
  if (idx === -1) return;

  const current = subSectionHeights[subId];
  const currentH = current !== null ? current : 200; // default if unset
  const newH = Math.max(60, currentH + delta);
  subSectionHeights[subId] = newH;

  // Adjust the next sub-section inversely
  const nextId = ids[idx + 1];
  if (nextId) {
    const next = subSectionHeights[nextId];
    const nextH = next !== null ? next : 200;
    subSectionHeights[nextId] = Math.max(60, nextH - delta);
  }
}

// ── Event forwarding ──────────────────────────────────────────────────────

function onSubAction(subsectionId: string, actionId: string) {
  emit('action', subsectionId, actionId);
}

function onComponentChange(componentId: string, value: unknown) {
  emit('component-change', componentId, value);
}
</script>

<template>
  <div
    class="sf-panel"
    :class="[
      'sf-panel--' + position,
      {
        'sf-panel--hidden': !visible,
        'sf-panel--dragging': dragging,
        'sf-panel--will-collapse': willCollapse,
      },
    ]"
    :data-collapse-edge="willCollapse ? oppositeEdge : undefined"
    :style="visible ? { width: width + 'px' } : {}"
  >
    <div
      class="sf-panel-resize-handle"
      :class="'sf-panel-resize-handle--' + resizeDir"
      @mousedown="onPanelResize"
    />

    <!-- Title bar -->
    <div class="sf-panel-header">
      <span class="sf-panel-title">{{ payload.title }}</span>
      <button
        class="sf-panel-menu-btn"
        title="Toggle sub-section visibility"
        @click.stop="titleMenuOpen = !titleMenuOpen"
      >
        ⋯
      </button>
      <!-- Title ⋯ dropdown -->
      <div v-if="titleMenuOpen" class="sf-panel-dropdown">
        <label
          v-for="sub in allSubSections"
          :key="sub.id"
          class="sf-panel-dropdown-item"
        >
          <input
            type="checkbox"
            :checked="!hiddenSubsections.has(sub.id)"
            @change="toggleSubSectionVisibility(sub.id)"
          />
          <span class="sf-panel-dropdown-label">{{ sub.sectionLabel }} → {{ sub.displayName }}</span>
        </label>
      </div>
    </div>

    <!-- Section tabs -->
    <div v-if="showTabs" class="sf-panel-tabs" ref="tabsRef">
      <button
        v-for="(sec, i) in payload.sections.slice(0, visibleTabCount)"
        :key="sec.id"
        class="sf-panel-tab"
        :class="{ 'sf-panel-tab--active': i === activeSectionIndex }"
        @click="activeSectionIndex = i"
      >
        {{ sec.label }}
      </button>
      <button
        v-if="hasOverflow"
        class="sf-panel-tab sf-panel-tab--overflow"
        @click.stop="overflowOpen = !overflowOpen"
      >
        ⋯
      </button>
      <!-- Overflow dropdown -->
      <div v-if="overflowOpen && hasOverflow" class="sf-panel-dropdown sf-panel-dropdown--right">
        <button
          v-for="(sec, i) in payload.sections.slice(visibleTabCount)"
          :key="sec.id"
          class="sf-panel-dropdown-item sf-panel-dropdown-item--btn"
          @click="activeSectionIndex = visibleTabCount + i; overflowOpen = false"
        >
          {{ sec.label }}
        </button>
      </div>
    </div>

    <!-- Sub-sections -->
    <div class="sf-panel-body">
      <PanelSubSection
        v-for="sub in activeSection.subSections"
        :key="sub.id"
        :def="sub"
        :height="getHeight(sub.id)"
        :is-last="isLastExpanded(sub.id)"
        :visible="!hiddenSubsections.has(sub.id)"
        :expanded="!collapsedIds.has(sub.id)"
        @resize="(delta: number) => onSubSectionResize(sub.id, delta)"
        @action="onSubAction"
        @component-change="onComponentChange"
        @toggle-collapse="(collapsed: boolean) => onToggleCollapse(sub.id, collapsed)"
      />
    </div>
  </div>
</template>
