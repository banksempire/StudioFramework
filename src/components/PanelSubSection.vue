<script setup lang="ts">
import { ref, watch } from 'vue';
import type { PanelSubSection as SubSectionDef } from '../types/panel.js';
import { useVerticalResize } from '../composables/useVerticalResize.js';
import PanelComponent from './PanelComponent.vue';

const props = defineProps<{
  def: SubSectionDef;
  /** Current height in px; null = auto (fills remaining space) */
  height: number | null;
  /** Whether this sub-section is the last expanded one (no resize handle) */
  isLast: boolean;
  /** Whether the parent panel is visible (suppress rendering when hidden) */
  visible: boolean;
  /** Whether this sub-section is expanded (controlled by parent) */
  expanded: boolean;
}>();

const emit = defineEmits<{
  'resize': [delta: number];
  'action': [subsectionId: string, actionId: string];
  'component-change': [componentId: string, value: unknown];
  'toggle-collapse': [collapsed: boolean];
}>();

const isLoading = ref(false);
const loaded = ref(!props.def.lazyLoad);

function toggleExpanded() {
  emit('toggle-collapse', props.expanded);
}

// Lazy load on first expand
watch(() => props.expanded, (val) => {
  if (val && props.def.lazyLoad && !loaded.value) {
    isLoading.value = true;
    emit('action', props.def.id, '_lazy-load');
  }
});

// Expose loaded state to be set by parent
function setLoaded() {
  loaded.value = true;
  isLoading.value = false;
}

defineExpose({ setLoaded });

const { dragging, onMouseDown } = useVerticalResize({
  min: 60,
  onDrag: (delta) => emit('resize', delta),
});

function onActionClick(actionId: string) {
  emit('action', props.def.id, actionId);
}

function onComponentChange(componentId: string, value: unknown) {
  emit('component-change', componentId, value);
}
</script>

<template>
  <div
    v-if="visible"
    class="sf-sub-section"
    :class="{
      'sf-sub-section--collapsed': !expanded,
      'sf-sub-section--dragging': dragging,
    }"
    :style="height !== null ? { height: height + 'px', flexShrink: 0 } : { flex: 1 }"
  >
    <!-- Header bar -->
    <div class="sf-sub-section-header" @click="toggleExpanded">
      <span class="sf-sub-section-arrow">{{ expanded ? '▼' : '▶' }}</span>
      <span class="sf-sub-section-title">{{ def.displayName }}</span>
      <span class="sf-sub-section-spacer" />
      <button
        v-for="btn in def.actionButtons"
        :key="btn.id"
        class="sf-sub-section-action"
        :title="btn.tooltip"
        @click.stop="onActionClick(btn.id)"
      >
        {{ btn.icon }}
      </button>
    </div>

    <!-- Components -->
    <div v-if="expanded" class="sf-sub-section-body">
      <div v-if="isLoading" class="sf-sub-section-loading">Loading…</div>
      <PanelComponent
        v-for="comp in def.components"
        :key="comp.id"
        :def="comp"
        @change="onComponentChange"
      />
    </div>

    <!-- Vertical resize handle (not on last expanded) -->
    <div
      v-if="expanded && !isLast"
      class="sf-sub-section-handle"
      @mousedown="onMouseDown"
    />
  </div>
</template>
