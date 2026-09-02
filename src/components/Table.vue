<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useSlots } from 'vue';
import type { TableColumn } from '../types/table';
import MultiSelectGroup from './MultiSelectGroup.vue';
import SvgIcon from './SvgIcon.vue';

const props = withDefaults(
  defineProps<{
    columns: TableColumn[];
    rows: Record<string, unknown>[];
    rowKey?: string | ((row: Record<string, unknown>, index: number) => string | number);
    rowTitle?: (row: Record<string, unknown>) => string | undefined;
    rowClass?: (row: Record<string, unknown>) => Record<string, boolean>;
    emptyText?: string;
  }>(),
  { emptyText: 'No rows.' },
);

const emit = defineEmits<{
  'row-click': [row: Record<string, unknown>];
  'update:columns': [columns: TableColumn[]];
}>();

const slots = useSlots();
const widths = reactive<Record<string, number>>({});
const sort = ref<{ key: string; dir: 'asc' | 'desc' } | null>(null);
const textFilters = reactive<Record<string, string>>({});
const selectFilters = reactive<Record<string, Array<string | number>>>({});
const openFilter = ref<string | null>(null);
const headRefs = reactive<Record<string, HTMLElement | undefined>>({});

const hasActions = computed(() => !!slots.actions);
const mobileLead = computed(() => props.columns.some((c) => c.mobile === 'lead'));
const mobileSub = computed(() => props.columns.some((c) => c.mobile === 'sub'));

const templateColumns = computed(() => {
  const cols = props.columns.map((c) => {
    const w = widths[c.key] ?? c.width;
    return w === undefined ? 'minmax(0, 1fr)' : `${w}px`;
  });
  return [...cols, ...(hasActions.value ? ['auto'] : [])].join(' ');
});

function cellWidth(c: TableColumn): number {
  if (widths[c.key] !== undefined) return widths[c.key];
  if (c.width !== undefined) return c.width;
  return headRefs[c.key]?.getBoundingClientRect().width ?? 0;
}

function cellAlign(c: TableColumn): 'left' | 'right' | 'center' {
  return c.align === 'right' || c.align === 'center' ? c.align : 'left';
}

function cellJustify(c: TableColumn): string {
  const a = cellAlign(c);
  return a === 'right' ? 'flex-end' : a === 'center' ? 'center' : 'flex-start';
}

function valueText(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function selectOptions(c: TableColumn) {
  const seen: string[] = [];
  for (const row of props.rows) {
    const s = valueText(row[c.key]);
    if (s !== '' && !seen.includes(s)) seen.push(s);
  }
  return seen.map((value) => ({ value, label: value, title: value }));
}

function filterActive(c: TableColumn): boolean {
  if (c.filter === 'text') return !!textFilters[c.key]?.trim();
  if (c.filter === 'select') return (selectFilters[c.key] ?? []).length > 0;
  return false;
}

const visibleRows = computed(() => {
  const out: Array<{ row: Record<string, unknown>; index: number }> = [];
  props.rows.forEach((row, index) => {
    for (const c of props.columns) {
      if (c.filter === 'text') {
        const q = (textFilters[c.key] ?? '').trim().toLowerCase();
        if (q && !valueText(row[c.key]).toLowerCase().includes(q)) return;
      }
      if (c.filter === 'select') {
        const pick = selectFilters[c.key] ?? [];
        if (pick.length > 0 && !pick.includes(valueText(row[c.key]))) return;
      }
    }
    out.push({ row, index });
  });
  const s = sort.value;
  if (!s) return out;
  const key = s.key;
  const dir = s.dir === 'asc' ? 1 : -1;
  const cmp = (a: { row: Record<string, unknown> }, b: { row: Record<string, unknown> }) => {
    const av = a.row[key];
    const bv = b.row[key];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return valueText(av).localeCompare(valueText(bv), undefined, { numeric: true }) * dir;
  };
  return [...out].sort(cmp);
});

function toggleSort(c: TableColumn) {
  if (!c.sortable) return;
  if (sort.value?.key !== c.key) {
    sort.value = { key: c.key, dir: 'asc' };
    return;
  }
  if (sort.value.dir === 'asc') {
    sort.value = { key: c.key, dir: 'desc' };
    return;
  }
  sort.value = null;
}

function togglePopover(key: string) {
  openFilter.value = openFilter.value === key ? null : key;
}

function onDocPointerDown(e: Event) {
  if (!openFilter.value) return;
  const el = e.target as HTMLElement | null;
  if (el?.closest('.sf-tbl-pop') || el?.closest('.sf-tbl-filterbtn')) return;
  openFilter.value = null;
}

function emitColumns() {
  emit(
    'update:columns',
    props.columns.map((c) => (widths[c.key] !== undefined ? { ...c, width: widths[c.key] } : c)),
  );
}

function startResize(e: PointerEvent, c: TableColumn) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startW = cellWidth(c);
  const min = c.min ?? 48;
  const onMove = (ev: PointerEvent) => {
    widths[c.key] = Math.max(min, Math.round(startW + (ev.clientX - startX)));
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.classList.remove('sf-tbl-resizing');
    emitColumns();
  };
  document.body.classList.add('sf-tbl-resizing');
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function resetWidth(c: TableColumn) {
  delete widths[c.key];
  emitColumns();
}

function rowId(row: Record<string, unknown>, index: number): string | number {
  if (typeof props.rowKey === 'string') return valueText(row[props.rowKey]);
  if (typeof props.rowKey === 'function') return props.rowKey(row, index);
  return index;
}

function setHeadRef(key: string, el: unknown) {
  headRefs[key] = (el as HTMLElement) ?? undefined;
}

onMounted(() => document.addEventListener('pointerdown', onDocPointerDown));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown));
</script>

<template>
  <div
    class="sf-tbl"
    :class="{ 'sf-tbl--m-lead': mobileLead, 'sf-tbl--m-sub': mobileSub }"
  >
    <div class="sf-tbl-head">
      <div
        v-for="c in columns"
        :key="c.key"
        :ref="(el) => setHeadRef(c.key, el)"
        class="sf-tbl-th"
        :class="{ 'sf-tbl-th--active': filterActive(c) }"
        :style="{ justifyContent: cellJustify(c) }"
      >
        <button
          v-if="c.sortable"
          class="sf-tbl-sortbtn"
          type="button"
          :title="`Sort by ${c.label}`"
          @click="toggleSort(c)"
        >
          {{ c.label }}<span
            v-if="sort?.key === c.key"
            class="sf-tbl-sortind"
          >{{ sort.dir === 'asc' ? '↑' : '↓' }}</span>
        </button>
        <span v-else class="sf-tbl-label">{{ c.label }}</span>
        <button
          v-if="c.filter"
          class="sf-tbl-filterbtn"
          :class="{ 'sf-tbl-filterbtn--on': filterActive(c), 'sf-tbl-filterbtn--open': openFilter === c.key }"
          type="button"
          :title="`Filter by ${c.label}`"
          @click.stop="togglePopover(c.key)"
        >
          <SvgIcon name="🔍" />
        </button>
        <span
          class="sf-tbl-resize"
          title="Drag to resize · double-click to reset"
          @pointerdown="startResize($event, c)"
          @dblclick.stop="resetWidth(c)"
        />
        <div v-if="c.filter && openFilter === c.key" class="sf-tbl-pop" @pointerdown.stop>
          <template v-if="c.filter === 'text'">
            <input
              v-model="textFilters[c.key]"
              class="sf-tbl-pop-input"
              type="text"
              :placeholder="`Filter ${c.label.toLowerCase()}…`"
            >
            <button
              v-if="filterActive(c)"
              class="sf-tbl-pop-clear"
              type="button"
              title="Clear"
              @click="textFilters[c.key] = ''"
            >✕</button>
          </template>
          <MultiSelectGroup
            v-else-if="c.filter === 'select'"
            v-model="selectFilters[c.key]"
            :options="selectOptions(c)"
          />
        </div>
      </div>
      <div v-if="hasActions" class="sf-tbl-th sf-tbl-th--actions" />
    </div>
    <div
      v-for="{ row, index } in visibleRows"
      :key="rowId(row, index)"
      class="sf-tbl-row"
      :class="rowClass?.(row)"
      :title="rowTitle?.(row)"
      @click="emit('row-click', row)"
    >
      <div
        v-for="c in columns"
        :key="c.key"
        class="sf-tbl-cell"
        :class="`sf-tbl-c--${c.mobile ?? 'hidden'}`"
        :style="{ textAlign: cellAlign(c) }"
      >
        <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">{{ valueText(row[c.key]) }}</slot>
      </div>
      <div v-if="hasActions" class="sf-tbl-cell sf-tbl-c--actions">
        <slot name="actions" :row="row" />
      </div>
    </div>
    <div v-if="!visibleRows.length" class="sf-tbl-empty">
      <slot name="empty" :filtered="props.rows.length > 0">{{ emptyText }}</slot>
    </div>
  </div>
</template>

<style scoped>
.sf-tbl {
  min-height: 0;
  font-size: inherit;
  color: var(--sf-text);
}

.sf-tbl-head,
.sf-tbl-row {
  display: grid;
  grid-template-columns: v-bind(templateColumns);
  gap: 8px;
  align-items: center;
  padding: 4px 8px;
}

.sf-tbl-head {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 30px;
  padding: 0 8px;
  font-size: 0.92em;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--sf-text-bright);
  background: var(--sf-bg-lighter);
  border-bottom: 1px solid var(--sf-border);
  user-select: none;
}

.sf-tbl-th {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.sf-tbl-sortbtn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: inherit;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-tbl-sortind {
  color: var(--sf-accent);
}

.sf-tbl-label {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-tbl-filterbtn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--sf-radius-sm);
  color: var(--sf-text-muted);
  cursor: pointer;
  opacity: 0.6;
}

.sf-tbl-filterbtn svg {
  width: 12px;
  height: 12px;
}

@media (hover: hover) {
  .sf-tbl-filterbtn:hover {
    opacity: 1;
    background: var(--sf-hover-overlay);
  }
}

.sf-tbl-filterbtn--on {
  opacity: 1;
  color: var(--sf-accent);
}

.sf-tbl-filterbtn--open {
  opacity: 1;
}

.sf-tbl-pop {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  display: flex;
  gap: 6px;
  min-width: 170px;
  max-width: 280px;
  margin-top: 3px;
  padding: 6px;
  background: var(--sf-bg-lighter);
  border: 1px solid var(--sf-border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  text-transform: none;
  font-weight: 400;
  letter-spacing: 0;
}

.sf-tbl-pop-input {
  flex: 1;
  min-width: 0;
  background: var(--sf-bg);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 13px;
  padding: 3px 6px;
  outline: none;
}

.sf-tbl-pop-input:focus {
  border-color: var(--sf-accent);
}

.sf-tbl-pop-clear {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: var(--sf-text-muted);
  cursor: pointer;
  border-radius: var(--sf-radius-sm);
}

@media (hover: hover) {
  .sf-tbl-pop-clear:hover {
    color: var(--sf-text);
    background: var(--sf-hover-overlay);
  }
}

.sf-tbl-resize {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
}

.sf-tbl-row {
  min-height: 32px;
  border-bottom: 1px solid var(--sf-border);
}

@media (hover: hover) {
  .sf-tbl-row:hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
  }
}

.sf-tbl-cell {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sf-tbl-c--actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.sf-tbl-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--sf-text-muted);
}

:slotted(.sf-tbl-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--sf-bar);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  color: var(--sf-text);
  font-family: var(--sf-font);
  padding: 2px 5px;
  cursor: pointer;
}

:slotted(.sf-tbl-btn svg) {
  width: 13px;
  height: 13px;
}

@media (hover: hover) {
  :slotted(.sf-tbl-btn:hover) {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
  }
}

:slotted(.sf-tbl-btn--danger) {
  background: var(--sf-danger);
  border-color: var(--sf-danger);
  color: var(--sf-text-on-accent);
}

body.sf-tbl-resizing {
  cursor: col-resize;
  user-select: none;
}

.sf-root--mobile .sf-tbl-head {
  display: none;
}

.sf-root--mobile .sf-tbl-row {
  grid-template:
    'title actions' auto
    'sub actions' auto / minmax(0, 1fr) auto;
  row-gap: 4px;
  align-content: center;
  padding: 8px;
}

.sf-root--mobile .sf-tbl--m-lead .sf-tbl-row {
  grid-template:
    'lead title actions' auto
    'lead sub actions' auto / auto minmax(0, 1fr) auto;
}

.sf-root--mobile .sf-tbl-c--hidden {
  display: none;
}

.sf-root--mobile .sf-tbl-c--lead {
  grid-area: lead;
}

.sf-root--mobile .sf-tbl-c--title {
  grid-area: title;
}

.sf-root--mobile .sf-tbl-c--sub {
  grid-area: sub;
  text-align: left;
}

.sf-root--mobile .sf-tbl-c--actions {
  grid-area: actions;
}

.sf-root--mobile .sf-tbl-c--actions :slotted(.sf-tbl-btn) {
  width: 44px;
  height: 44px;
  padding: 0;
}
</style>
