<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useSlots } from 'vue';
import type { TableColumn } from '../types/table';

const props = withDefaults(
  defineProps<{
    columns: TableColumn[];
    rows: Record<string, unknown>[];
    rowKey?: string | ((row: Record<string, unknown>, index: number) => string | number);
    rowTitle?: (row: Record<string, unknown>) => string | undefined;
    rowClass?: (row: Record<string, unknown>) => Record<string, boolean>;
    emptyText?: string;
    rowNumbers?: boolean;
  }>(),
  { emptyText: 'No rows.', rowNumbers: false },
);

const emit = defineEmits<{
  'row-click': [row: Record<string, unknown>];
  'update:columns': [columns: TableColumn[]];
}>();

const slots = useSlots();
const widths = reactive<Record<string, number>>({});
const sort = ref<{ key: string; dir: 'asc' | 'desc' } | null>(null);
const queries = reactive<Record<string, string>>({});
const excluded = reactive<Record<string, string[]>>({});
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
  return [...(props.rowNumbers ? ['34px'] : []), ...cols, ...(hasActions.value ? ['auto'] : [])].join(' ');
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

function uniqueValues(c: TableColumn): string[] {
  const seen: string[] = [];
  for (const row of props.rows) {
    const s = valueText(row[c.key]);
    if (s !== '' && !seen.includes(s)) seen.push(s);
  }
  return seen;
}

function listValues(c: TableColumn): string[] {
  const q = (queries[c.key] ?? '').trim().toLowerCase();
  if (!q) return uniqueValues(c);
  return uniqueValues(c).filter((v) => v.toLowerCase().includes(q));
}

function filterActive(c: TableColumn): boolean {
  if (!c.filter) return false;
  return !!queries[c.key]?.trim() || (excluded[c.key] ?? []).length > 0;
}

function clearFilter(c: TableColumn) {
  queries[c.key] = '';
  excluded[c.key] = [];
}

function isChecked(c: TableColumn, v: string): boolean {
  return !(excluded[c.key] ?? []).includes(v);
}

function toggleValue(c: TableColumn, v: string) {
  const cur = excluded[c.key] ?? [];
  excluded[c.key] = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
}

function toggleAll(c: TableColumn) {
  excluded[c.key] = (excluded[c.key] ?? []).length > 0 ? [] : uniqueValues(c);
}

const visibleRows = computed(() => {
  const out: Array<{ row: Record<string, unknown>; index: number }> = [];
  props.rows.forEach((row, index) => {
    for (const c of props.columns) {
      if (c.filter) {
        const q = (queries[c.key] ?? '').trim().toLowerCase();
        if (q && !valueText(row[c.key]).toLowerCase().includes(q)) return;
        if ((excluded[c.key] ?? []).includes(valueText(row[c.key]))) return;
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

function setSort(c: TableColumn, dir: 'asc' | 'desc') {
  if (!c.sortable) return;
  sort.value = sort.value?.key === c.key && sort.value.dir === dir ? null : { key: c.key, dir };
}

function onHeadClick(c: TableColumn) {
  if (c.filter) {
    togglePopover(c.key);
    return;
  }
  toggleSort(c);
}

function togglePopover(key: string) {
  openFilter.value = openFilter.value === key ? null : key;
}

function onDocPointerDown(e: Event) {
  if (!openFilter.value) return;
  const el = e.target as HTMLElement | null;
  if (el?.closest('.sf-tbl-pop') || el?.closest('.sf-tbl-hbtn')) return;
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
      <div v-if="rowNumbers" class="sf-tbl-th sf-tbl-gutter"><span class="sf-tbl-hlabel">#</span></div>
      <div
        v-for="c in columns"
        :key="c.key"
        :ref="(el) => setHeadRef(c.key, el)"
        class="sf-tbl-th"
        :class="{ 'sf-tbl-th--active': filterActive(c) || sort?.key === c.key }"
        :style="{ justifyContent: cellJustify(c) }"
      >
        <button
          v-if="c.sortable || c.filter"
          class="sf-tbl-hbtn"
          type="button"
          :title="c.filter ? `Sort or filter by ${c.label}` : `Sort by ${c.label}`"
          @click.stop="onHeadClick(c)"
        >
          <span class="sf-tbl-hlabel">{{ c.label }}</span>
          <span v-if="sort?.key === c.key" class="sf-tbl-sortind">{{ sort.dir === 'asc' ? '↑' : '↓' }}</span>
          <span v-else class="sf-tbl-harrow">▾</span>
        </button>
        <span v-else class="sf-tbl-hlabel">{{ c.label }}</span>
        <span
          class="sf-tbl-resize"
          title="Drag to resize · double-click to reset"
          @pointerdown="startResize($event, c)"
          @dblclick.stop="resetWidth(c)"
        />
        <div v-if="c.filter && openFilter === c.key" class="sf-tbl-pop" @pointerdown.stop>
          <div v-if="c.sortable" class="sf-tbl-pop-sort">
            <button
              class="sf-tbl-pop-sortbtn"
              :class="{ 'sf-tbl-pop-sortbtn--on': sort?.key === c.key && sort.dir === 'asc' }"
              type="button"
              @click="setSort(c, 'asc')"
            >↑ A→Z</button>
            <button
              class="sf-tbl-pop-sortbtn"
              :class="{ 'sf-tbl-pop-sortbtn--on': sort?.key === c.key && sort.dir === 'desc' }"
              type="button"
              @click="setSort(c, 'desc')"
            >↓ Z→A</button>
          </div>
          <div class="sf-tbl-pop-search">
            <input
              v-model="queries[c.key]"
              class="sf-tbl-pop-input"
              type="text"
              :placeholder="`Search ${c.label.toLowerCase()}…`"
            >
            <button
              v-if="filterActive(c)"
              class="sf-tbl-pop-clear"
              type="button"
              title="Clear"
              @click="clearFilter(c)"
            >✕</button>
          </div>
          <div v-if="listValues(c).length" class="sf-tbl-pop-list">
            <label class="sf-tbl-chk sf-tbl-chk--all">
              <input
                type="checkbox"
                :checked="(excluded[c.key] ?? []).length === 0"
                @change="toggleAll(c)"
              >
              <span class="sf-tbl-chk-val">(Select all)</span>
            </label>
            <label v-for="v in listValues(c)" :key="v" class="sf-tbl-chk">
              <input type="checkbox" :checked="isChecked(c, v)" @change="toggleValue(c, v)">
              <span class="sf-tbl-chk-val" :title="v">{{ v }}</span>
            </label>
          </div>
          <span v-else class="sf-tbl-pop-none">no matching items</span>
        </div>
      </div>
      <div v-if="hasActions" class="sf-tbl-th sf-tbl-th--actions">
        <div v-if="visibleRows.length" class="sf-tbl-sizer" aria-hidden="true">
          <slot name="actions" :row="visibleRows[0].row" />
        </div>
      </div>
    </div>
    <div
      v-for="({ row, index }, i) in visibleRows"
      :key="rowId(row, index)"
      class="sf-tbl-row"
      :class="rowClass?.(row)"
      :title="rowTitle?.(row)"
      @click="emit('row-click', row)"
    >
      <div v-if="rowNumbers" class="sf-tbl-cell sf-tbl-gutter">{{ i + 1 }}</div>
      <div
        v-for="c in columns"
        :key="c.key"
        class="sf-tbl-cell"
        :class="`sf-tbl-c--${c.mobile ?? 'hidden'}`"
        :style="{ justifyContent: cellJustify(c) }"
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
  border-top: 1px solid var(--sf-border);
  border-left: 1px solid var(--sf-border);
}

.sf-tbl-head,
.sf-tbl-row {
  display: grid;
  grid-template-columns: v-bind(templateColumns);
  align-items: stretch;
}

.sf-tbl-head {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 28px;
  font-size: 0.92em;
  font-weight: 600;
  color: var(--sf-text-bright);
  background: var(--sf-bg-lighter);
  user-select: none;
}

.sf-tbl-th {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 4px 0 8px;
  border-right: 1px solid var(--sf-border);
  border-bottom: 1px solid var(--sf-border);
}

.sf-tbl-hbtn {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.sf-tbl-hlabel {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-tbl-harrow {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--sf-text-muted);
}

.sf-tbl-sortind {
  flex-shrink: 0;
  color: var(--sf-accent);
}

.sf-tbl-th--active .sf-tbl-harrow {
  color: var(--sf-accent);
}

.sf-tbl-pop {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 190px;
  max-width: 280px;
  margin-top: 2px;
  padding: 6px;
  background: var(--sf-bg-lighter);
  border: 1px solid var(--sf-border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}

.sf-tbl-pop-sort {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.sf-tbl-pop-sortbtn {
  background: var(--sf-bar);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 12px;
  padding: 3px 4px;
  cursor: pointer;
  white-space: nowrap;
}

@media (hover: hover) {
  .sf-tbl-pop-sortbtn:hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
  }
}

.sf-tbl-pop-sortbtn--on {
  color: var(--sf-accent);
  border-color: var(--sf-accent);
}

.sf-tbl-pop-search {
  display: flex;
  gap: 4px;
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

.sf-tbl-pop-list {
  display: flex;
  flex-direction: column;
  max-height: 190px;
  overflow: auto;
  margin: 0 -2px;
  padding: 0 2px;
}

.sf-tbl-chk {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 0 4px;
  border-radius: 4px;
  cursor: pointer;
}

@media (hover: hover) {
  .sf-tbl-chk:hover {
    background: var(--sf-hover-overlay);
  }
}

.sf-tbl-chk input {
  accent-color: var(--sf-accent);
  flex-shrink: 0;
}

.sf-tbl-chk--all {
  border-bottom: 1px solid var(--sf-border);
  border-radius: 0;
  margin-bottom: 2px;
}

.sf-tbl-chk-val {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}

.sf-tbl-pop-none {
  color: var(--sf-text-muted);
  padding: 2px 4px;
  font-size: 13px;
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
  min-height: 28px;
}

@media (hover: hover) {
  .sf-tbl-row:hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
  }
}

.sf-tbl-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  padding: 0 8px;
  border-right: 1px solid var(--sf-border);
  border-bottom: 1px solid var(--sf-border);
}

.sf-tbl-cell > :slotted(*) {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-tbl-gutter {
  justify-content: center;
  padding: 0 4px;
  color: var(--sf-text-muted);
  font-size: 0.9em;
}

.sf-tbl-c--actions {
  justify-content: flex-end;
  gap: 4px;
  padding: 0 4px;
}

.sf-tbl-th--actions {
  padding: 0;
}

.sf-tbl-sizer {
  display: flex;
  gap: 4px;
  height: 0;
  padding: 0 4px;
  visibility: hidden;
  overflow: hidden;
}

.sf-tbl-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--sf-text-muted);
  border-right: 1px solid var(--sf-border);
  border-bottom: 1px solid var(--sf-border);
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

.sf-root--mobile .sf-tbl {
  border: none;
}

.sf-root--mobile .sf-tbl-th,
.sf-root--mobile .sf-tbl-cell {
  border: none;
}

.sf-root--mobile .sf-tbl-cell {
  display: block;
  text-align: left;
}

.sf-root--mobile .sf-tbl-c--actions {
  display: flex;
}

.sf-root--mobile .sf-tbl-gutter {
  display: none;
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
  border-bottom: 1px solid var(--sf-border);
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
  justify-content: flex-start;
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
