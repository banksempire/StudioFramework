<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { PopupOption } from '../types/popup';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: PopupOption[];
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    title?: string;
  }>(),
  { id: undefined, placeholder: undefined, disabled: false, title: undefined },
);

const emit = defineEmits<(e: 'update:modelValue', value: string) => void>();

const query = ref<string | null>(null);
const open = ref(false);
const cursor = ref(0);

const boxEl = ref<HTMLElement | null>(null);
const popEl = ref<HTMLElement | null>(null);

function syncCursorToSelection() {
  const at = matches.value.findIndex((o) => o.value === props.modelValue);
  cursor.value = at >= 0 ? at : 0;
}

async function scrollCursorIntoView() {
  await nextTick();
  popEl.value?.children[cursor.value]?.scrollIntoView({ block: 'nearest' });
}
const popStyle = ref<{ left: string; top: string; width: string; maxHeight: string }>({
  left: '0px',
  top: '0px',
  width: '0px',
  maxHeight: '240px',
});

const teleportTarget = ref<HTMLElement | string>('body');
onMounted(() => {
  teleportTarget.value = (document.querySelector('.sf-root') as HTMLElement | null) ?? 'body';
});

function labelOf(value: string): string {
  return props.options.find((o) => o.value === value)?.label ?? value;
}

const display = computed(() => query.value ?? labelOf(props.modelValue));

const matches = computed(() => {
  const q = (query.value ?? '').trim().toLowerCase();
  const all = props.options;
  if (!q) return all.slice(0, 12);
  const out = all.filter(
    (o) => String(o.label).toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q),
  );
  return out.slice(0, 12);
});

async function positionPopup() {
  await nextTick();
  const box = boxEl.value;
  const pop = popEl.value;
  if (!box || !pop || !open.value) return;
  const rect = box.getBoundingClientRect();
  const width = Math.max(rect.width, 180);
  const h = pop.offsetHeight || 40;
  let left = rect.left;
  if (left + width > window.innerWidth - 4) left = Math.max(4, window.innerWidth - width - 4);
  const below = window.innerHeight - rect.bottom - 8;
  const above = rect.top - 8;
  const flip = below < Math.min(h, 160) && above > below;
  const maxH = Math.max(96, Math.min(240, flip ? above : below));
  const shown = Math.min(h, maxH);
  const top = flip ? Math.max(4, rect.top - shown - 4) : rect.bottom + 4;
  popStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px`, maxHeight: `${maxH}px` };
}

function startTracking() {
  window.addEventListener('resize', positionPopup);
  window.addEventListener('scroll', positionPopup, true);
}

function stopTracking() {
  window.removeEventListener('resize', positionPopup);
  window.removeEventListener('scroll', positionPopup, true);
}

watch(open, (v) => {
  if (v) {
    startTracking();
    void positionPopup();
  } else {
    stopTracking();
  }
});

watch(matches, () => {
  if (open.value) void positionPopup();
});

onUnmounted(stopTracking);

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value;
  open.value = true;
  cursor.value = 0;
}

function onFocus() {
  query.value = null;
  open.value = true;
  syncCursorToSelection();
  void scrollCursorIntoView();
}

function onBoxClick(event: MouseEvent) {
  open.value = true;
  (event.target as HTMLInputElement).select();
  syncCursorToSelection();
  void scrollCursorIntoView();
}

function onRowEnter(i: number) {
  cursor.value = i;
}

function pick(option: PopupOption) {
  query.value = null;
  open.value = false;
  if (option.value !== props.modelValue) emit('update:modelValue', String(option.value));
}

function commitText() {
  const q = query.value;
  query.value = null;
  open.value = false;
  if (!q) return;
  const exact = props.options.find((o) => String(o.label).toLowerCase() === q.trim().toLowerCase());
  if (exact) {
    if (exact.value !== props.modelValue) emit('update:modelValue', String(exact.value));
    return;
  }
  const single = matches.value.length === 1 ? matches.value[0] : null;
  if (single && single.value !== props.modelValue) emit('update:modelValue', String(single.value));
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    const hit = matches.value[cursor.value];
    if (open.value && hit) pick(hit);
    else commitText();
  } else if (event.key === 'Escape') {
    if (open.value) event.stopPropagation();
    query.value = null;
    open.value = false;
  } else if (event.key === 'ArrowDown') {
    open.value = true;
    cursor.value = Math.min(cursor.value + 1, matches.value.length - 1);
    void scrollCursorIntoView();
  } else if (event.key === 'ArrowUp') {
    cursor.value = Math.max(cursor.value - 1, 0);
    void scrollCursorIntoView();
  }
}
</script>

<template>
  <div ref="boxEl" class="sf-search-select">
    <input
      :id="id"
      class="sf-form-input sf-search-select-box"
      type="text"
      :value="display"
      :placeholder="placeholder ?? 'search…'"
      :disabled="disabled"
      :title="title"
      spellcheck="false"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @click="onBoxClick"
      @blur="commitText"
      @keydown="onKeydown"
    />
  </div>
  <Teleport :to="teleportTarget">
    <div v-if="open && matches.length" ref="popEl" class="sf-search-select-pop" :style="popStyle">
      <button
        v-for="(opt, i) in matches"
        :key="String(opt.value)"
        type="button"
        class="sf-search-select-row"
        :class="{ 'sf-search-select-row--on': i === cursor }"
        @mouseenter="onRowEnter(i)"
        @mousedown.prevent="pick(opt)"
      >
        {{ opt.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.sf-search-select {
  position: relative;
  min-width: 0;
}

.sf-search-select-box {
  width: 100%;
  min-width: 0;
}

.sf-search-select-pop {
  position: fixed;
  z-index: 1200;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--sf-bg, #1b1d22);
  border: 1px solid var(--sf-border);
  border-radius: 8px;
  box-shadow: var(--sf-shadow);
  display: flex;
  flex-direction: column;
}

.sf-search-select-row {
  flex: none;
  text-align: left;
  padding: 7px 10px;
  background: transparent;
  border: none;
  color: var(--sf-text);
  font-size: 16px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sf-search-select-row--on {
  color: var(--sf-text-bright);
  background: var(--sf-hover-overlay, rgba(255, 255, 255, 0.06));
}
</style>
