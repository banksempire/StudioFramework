<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useSwipeReveal } from '../composables/useSwipeReveal';
import type { IconDef } from '../types/panel';
import Icon from './Icon.vue';
import SvgIcon from './SvgIcon.vue';

export interface TabDropdownItem {
  id: string;
  label: string;
  icon?: IconDef;
  closeable?: boolean;
}

const props = withDefaults(
  defineProps<{
    open?: boolean;
    items: TabDropdownItem[];
    activeId?: string | null;
  }>(),
  { open: false, activeId: null },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [id: string];
  close: [id: string];
}>();

const SWIPE_REVEAL = 86;

const swipe = useSwipeReveal({
  revealWidth: () => SWIPE_REVEAL,
  onCommit: (id) => emit('close', id),
});
const {
  styleOf: slideStyle,
  underWidth,
  isSwiping,
  isRevealed,
  isLayerVisible: isBtnVisible,
  isArmed,
} = swipe;

function onDown(e: PointerEvent, tab: TabDropdownItem) {
  if (tab.closeable === false) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  swipe.begin(tab.id, e);
}

function onSlideClick(id: string) {
  if (swipe.consumeClick(id)) return;
  if (swipe.isRevealed(id)) {
    swipe.hide(id);
    return;
  }
  emit('select', id);
  emit('update:open', false);
}

function onClose(id: string) {
  if (swipe.consumeClick(id)) return;
  swipe.hide(id);
  emit('close', id);
}

function closeSheet() {
  emit('update:open', false);
}

watch(
  () => props.open,
  (o) => {
    if (o) return;
    swipe.reset();
  },
);

const sheetTarget = ref<HTMLElement | 'body'>('body');
onMounted(() => {
  sheetTarget.value = (document.querySelector('.sf-root') as HTMLElement | null) ?? 'body';
});
</script>

<template>
  <Teleport :to="sheetTarget">
    <div v-if="open" class="sf-tab-dropdown">
      <div class="sf-tab-dropdown-bar">
        <span class="sf-tab-dropdown-title">tabs</span>
        <button class="sf-tab-dropdown-close" title="Close" @click="closeSheet">
          <SvgIcon name="✕" />
        </button>
      </div>
      <div class="sf-tab-dropdown-body">
        <div class="sf-tab-dropdown-list">
          <div
            v-for="tab in items"
            :key="tab.id"
            class="sf-tab-dropdown-row"
            :class="{ 'sf-tab-dropdown-row--revealed': isRevealed(tab.id) }"
          >
            <button
              v-if="tab.closeable !== false"
              class="sf-tab-dropdown-close-btn"
              :class="{
                revealed: isRevealed(tab.id),
                active: isBtnVisible(tab.id),
                armed: isArmed(tab.id),
              }"
              :style="{ width: `${underWidth(tab.id)}px` }"
              title="Close tab"
              @pointerdown="onDown($event, tab)"
              @pointermove="swipe.move($event, tab.id)"
              @pointerup="swipe.end(tab.id)"
              @pointercancel="swipe.end(tab.id)"
              @touchmove="swipe.touchMove($event, tab.id)"
              @click.stop="onClose(tab.id)"
            >
              <SvgIcon name="✕" />
              <span>Close</span>
            </button>
            <div
              class="sf-tab-dropdown-slide"
              :class="{ 'sf-tab-dropdown-slide--swiping': isSwiping(tab.id) }"
              :style="slideStyle(tab.id)"
              @pointerdown="onDown($event, tab)"
              @pointermove="swipe.move($event, tab.id)"
              @pointerup="swipe.end(tab.id)"
              @pointercancel="swipe.end(tab.id)"
              @touchmove="swipe.touchMove($event, tab.id)"
              @click="onSlideClick(tab.id)"
            >
              <span v-if="tab.id === activeId" class="sf-tab-dropdown-mark" />
              <span class="sf-tab-dropdown-icon">
                <Icon v-if="tab.icon" :icon="tab.icon" />
              </span>
              <span class="sf-tab-dropdown-label">{{ tab.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
