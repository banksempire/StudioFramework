<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue';
import type { PopupField, PopupOption, PopupValues } from '../types/popup';
import SvgIcon from './SvgIcon.vue';

const props = defineProps<{
  field: PopupField;
  values: PopupValues;
  inputId: string;
  busy?: boolean;
}>();

const emit = defineEmits<(e: 'patch', key: string, value: string | number | boolean) => void>();

type Row = { kind: 'group'; label: string } | { kind: 'option'; option: PopupOption; index: number };

interface ChoiceGroup {
  group: string;
  options: PopupOption[];
}

const open = ref(false);
const active = ref(-1);
const popStyle = ref<{ left: string; top: string; width: string }>({ left: '0px', top: '0px', width: '0px' });
const triggerEl = ref<HTMLButtonElement | null>(null);
const popEl = ref<HTMLDivElement | null>(null);
let typeBuffer = '';
let typeTimer: ReturnType<typeof setTimeout> | undefined;

const popId = `${props.inputId}-listbox`;

const rows = computed<Row[]>(() => {
  const choices = props.field.options ?? [];
  if (choices.length > 0 && 'group' in choices[0]) {
    const out: Row[] = [];
    let index = 0;
    for (const g of choices as ChoiceGroup[]) {
      out.push({ kind: 'group', label: g.group });
      for (const option of g.options) out.push({ kind: 'option', option, index: index++ });
    }
    return out;
  }
  return (choices as PopupOption[]).map((option, index) => ({ kind: 'option', option, index }));
});

const optionRows = computed(() =>
  rows.value.filter((r): r is Extract<Row, { kind: 'option' }> => r.kind === 'option'),
);

const currentIndex = computed(() => {
  const v = props.values[props.field.key];
  const at = optionRows.value.findIndex((r) => String(r.option.value) === String(v ?? ''));
  return at;
});

const triggerLabel = computed(() => {
  const at = currentIndex.value;
  if (at >= 0) return optionRows.value[at].option.label;
  return props.field.blankLabel ?? '';
});

const triggerBlank = computed(() => currentIndex.value < 0);

function optionId(index: number) {
  return `${props.inputId}-opt-${index}`;
}

function firstEnabled(from: number) {
  const n = optionRows.value.length;
  for (let step = 0; step < n; step++) {
    const i = (from + step + n * 4) % n;
    if (!optionRows.value[i].option.disabled) return i;
  }
  return -1;
}

function scrollActive() {
  if (!open.value || active.value < 0) return;
  popEl.value?.querySelector(`#${CSS.escape(optionId(active.value))}`)?.scrollIntoView({ block: 'nearest' });
}

function positionPopup() {
  const trigger = triggerEl.value;
  const pop = popEl.value;
  if (!trigger || !pop) return;
  const rect = trigger.getBoundingClientRect();
  const w = Math.max(rect.width, 120);
  const h = pop.offsetHeight || 40;
  let left = rect.left;
  if (left + w > window.innerWidth - 4) left = Math.max(4, window.innerWidth - w - 4);
  let top = rect.bottom + 2;
  if (top + h > window.innerHeight - 4) top = Math.max(4, rect.top - h - 2);
  popStyle.value = { left: `${left}px`, top: `${top}px`, width: `${w}px` };
}

async function openPopup() {
  if (props.field.disabled || props.busy || open.value) return;
  open.value = true;
  active.value = currentIndex.value >= 0 ? currentIndex.value : firstEnabled(0);
  await nextTick();
  positionPopup();
  popEl.value?.focus({ preventScroll: true });
  scrollActive();
}

function closePopup(refocus = true) {
  if (!open.value) return;
  open.value = false;
  typeBuffer = '';
  if (refocus) triggerEl.value?.focus({ preventScroll: true });
}

function choose(option: PopupOption) {
  if (option.disabled) return;
  emit('patch', props.field.key, option.value);
  closePopup();
}

function move(delta: number) {
  const n = optionRows.value.length;
  if (n === 0) return;
  let i = active.value;
  for (let step = 0; step < n; step++) {
    i = (i + delta + n) % n;
    if (!optionRows.value[i].option.disabled) {
      active.value = i;
      scrollActive();
      return;
    }
  }
}

function jumpTo(prefix: string) {
  const needle = prefix.toLowerCase();
  const n = optionRows.value.length;
  for (let step = 1; step <= n; step++) {
    const i = (active.value + step) % n;
    const candidate = optionRows.value[i];
    if (!candidate.option.disabled && candidate.option.label.toLowerCase().startsWith(needle)) {
      active.value = i;
      scrollActive();
      return;
    }
  }
}

function onPopKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    move(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    move(-1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    const i = firstEnabled(0);
    if (i >= 0) {
      active.value = i;
      scrollActive();
    }
  } else if (e.key === 'End') {
    e.preventDefault();
    const i = firstEnabled(optionRows.value.length - 1);
    if (i >= 0) {
      active.value = i;
      scrollActive();
    }
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const row = optionRows.value[active.value];
    if (row) choose(row.option);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closePopup();
  } else if (e.key === 'Tab') {
    closePopup(false);
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    clearTimeout(typeTimer);
    typeBuffer += e.key.toLowerCase();
    typeTimer = setTimeout(() => {
      typeBuffer = '';
    }, 500);
    jumpTo(typeBuffer);
  }
}

function onDocDown(e: MouseEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  if (triggerEl.value?.contains(t) || popEl.value?.contains(t)) return;
  closePopup(false);
}

window.addEventListener('mousedown', onDocDown);
onUnmounted(() => {
  window.removeEventListener('mousedown', onDocDown);
  clearTimeout(typeTimer);
});
</script>

<template>
  <button
    :id="inputId"
    ref="triggerEl"
    type="button"
    class="sf-form-input sf-form-select"
    :class="[{ 'sf-form-select--blank': triggerBlank }, field.inputClass]"
    role="combobox"
    :aria-expanded="open"
    aria-haspopup="listbox"
    :aria-controls="open ? popId : undefined"
    :disabled="field.disabled || busy"
    :title="field.labelNote"
    @click="open ? closePopup() : openPopup()"
    @keydown.down.prevent="openPopup()"
    @keydown.enter.prevent="openPopup()"
    @keydown.space.prevent="openPopup()"
  >{{ triggerLabel }}</button>
  <Teleport to="body">
    <div v-if="open" :id="popId" ref="popEl" class="sf-select-pop" :style="popStyle" role="listbox" tabindex="-1" :aria-activedescendant="active >= 0 ? optionId(active) : undefined" @keydown="onPopKey">
      <template v-for="(row, i) in rows" :key="row.kind === 'group' ? `group-${row.label}-${i}` : optionId(row.index)">
        <div v-if="row.kind === 'group'" class="sf-select-group">{{ row.label }}</div>
        <div
          v-else
          :id="optionId(row.index)"
          class="sf-select-row"
          :class="{
            'sf-select-row--selected': row.index === currentIndex,
            'sf-select-row--active': row.index === active,
            'sf-select-row--disabled': row.option.disabled,
          }"
          role="option"
          :aria-selected="row.index === currentIndex"
          :aria-disabled="row.option.disabled || undefined"
          :title="row.option.title"
          @mouseenter="!row.option.disabled && (active = row.index)"
          @click="choose(row.option)"
        >
          <span class="sf-select-row-label">{{ row.option.label }}</span>
          <SvgIcon v-if="row.index === currentIndex" class="sf-select-mark" name="✓" />
        </div>
      </template>
    </div>
  </Teleport>
</template>
