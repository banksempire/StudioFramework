<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useSlots, watch } from 'vue';
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
    searchable?: boolean;
    searchPlaceholder?: string;
  }>(),
  { emptyText: 'No rows.', rowNumbers: false, searchable: false, searchPlaceholder: 'Search…' },
);

const emit = defineEmits<{
  'row-click': [row: Record<string, unknown>];
  'update:columns': [columns: TableColumn[]];
}>();

const slots = useSlots();
const widths = reactive<Record<string, number>>({});
const hiddenCols = reactive<Record<string, boolean>>({});
const sort = ref<{ key: string; dir: 'asc' | 'desc' } | null>(null);
const queries = reactive<Record<string, string>>({});
const globalQuery = ref('');
const excluded = reactive<Record<string, string[]>>({});
const openFilter = ref<string | null>(null);
const colMenu = ref<{ key: string; x: number; y: number } | null>(null);
const actionsWidth = ref<number | null>(null);
const sizerEl = ref<HTMLElement | null>(null);
const headRefs = reactive<Record<string, HTMLElement | undefined>>({});
const contentWidths: Record<string, number> = {};
const varWidths = reactive<Record<string, number>>({});
const tblEl = ref<HTMLElement | null>(null);

function isVarColumn(c: TableColumn): boolean {
  return (widths[c.key] ?? c.width) === undefined;
}

function visibleVars(): TableColumn[] {
  return visibleColumns.value.filter(isVarColumn);
}

function measureAutoColumns() {
  const root = tblEl.value;
  if (!root) return;
  const vis = visibleColumns.value;
  const cells = [...root.querySelectorAll<HTMLElement>('[data-col]')];
  const saved: Array<[HTMLElement, string]> = [];
  for (const el of cells) {
    saved.push([el, el.style.cssText]);
    el.style.width = 'max-content';
  }
  const measured: Record<string, number> = {};
  for (const c of vis) {
    if (!isVarColumn(c)) continue;
    let w = 0;
    for (const el of cells) {
      if (el.dataset.col === c.key) w = Math.max(w, el.getBoundingClientRect().width);
    }
    if (w === 0) continue;
    measured[c.key] = Math.ceil(w + 17);
  }
  for (const [el, css] of saved) el.style.cssText = css;
  for (const [k, raw] of Object.entries(measured)) {
    const c = vis.find((col) => col.key === k);
    if (!c) continue;
    const min = c.min ?? 48;
    const max = c.max ?? 260;
    const content = Math.ceil(Math.min(max, Math.max(min, raw)));
    contentWidths[k] = content;
    varWidths[k] = Math.max(varWidths[k] ?? content, content);
  }
  distribute();
}

function distribute() {
  const root = tblEl.value;
  if (!root) return;
  const vis = visibleColumns.value;
  const vars = visibleVars();
  if (!vars.length) return;
  if (vars.some((c) => varWidths[c.key] === undefined)) return;
  const container = (root.parentElement?.clientWidth ?? 0) - (props.rowNumbers ? 34 : 0);
  const fixed =
    vis.reduce((sum, c) => {
      const w = widths[c.key] ?? c.width;
      return w !== undefined ? sum + w : sum;
    }, 0) + (actionsWidth.value ?? 0);
  const used = vars.reduce((sum, c) => sum + (varWidths[c.key] ?? 48), 0);
  const unallocated = container - fixed - used;
  if (unallocated > 0) {
    const first = vars[0];
    varWidths[first.key] = (varWidths[first.key] ?? 48) + unallocated;
  } else if (unallocated < 0) {
    squeezeVars(vars, -unallocated, null);
  }
}

function squeezeVars(cols: TableColumn[], needed: number, base: Map<string, number> | null): number {
  let freed = 0;
  for (const c of cols) {
    if (freed >= needed) break;
    const start = base ? (base.get(c.key) ?? 48) : (varWidths[c.key] ?? 48);
    const canGive = start - (c.min ?? 48);
    if (canGive <= 0) continue;
    const give = Math.min(canGive, needed - freed);
    varWidths[c.key] = start - give;
    freed += give;
  }
  return freed;
}

const hasActions = computed(() => !!slots.actions);
const hasLeadSlot = computed(() => !!slots['search-lead']);
const hasEndSlot = computed(() => !!slots['search-end']);
const hasToolbarSides = computed(() => hasLeadSlot.value || hasEndSlot.value);
const visibleColumns = computed(() => props.columns.filter((c) => !(hiddenCols[c.key] ?? c.hidden === true)));
const mobileLead = computed(() => visibleColumns.value.some((c) => c.mobile === 'lead'));
const mobileSub = computed(() => visibleColumns.value.some((c) => c.mobile === 'sub'));

const handleFlags = computed(() => {
  const vis = visibleColumns.value;
  const flags: boolean[] = [];
  for (let i = 0; i < vis.length - 1; i++) {
    flags.push(vis.slice(i + 1).some(isVarColumn));
  }
  return flags;
});

const templateColumns = computed(() => {
  const vis = visibleColumns.value;
  const cols = vis.map((c) => {
    const w = widths[c.key] ?? c.width;
    if (w !== undefined) return `${w}px`;
    return `${varWidths[c.key] ?? c.min ?? 48}px`;
  });
  return [
    ...(props.rowNumbers ? ['34px'] : []),
    ...cols,
    ...(hasActions.value ? [actionsWidth.value === null ? 'auto' : `${actionsWidth.value}px`] : []),
  ].join(' ');
});

const sizerObserver = new ResizeObserver(() => {
  if (sizerEl.value) actionsWidth.value = sizerEl.value.offsetWidth;
});

function setSizerEl(el: unknown) {
  sizerEl.value = (el as HTMLElement) ?? null;
  if (sizerEl.value) sizerObserver.observe(sizerEl.value);
}

watch(
  () => [
    props.rows.length,
    visibleColumns.value.map((c) => c.key).join('|'),
    props.rows[0] ? Object.values(props.rows[0]).join('\u0001') : '',
    actionsWidth.value,
  ],
  () => {
    void nextTick(measureAutoColumns);
  },
  { immediate: true },
);

const tblObserver = new ResizeObserver(() => {
  distribute();
});
const tblObserved = new WeakSet<HTMLElement>();

function setTblEl(el: unknown) {
  tblEl.value = (el as HTMLElement) ?? null;
  if (tblEl.value && !tblObserved.has(tblEl.value)) {
    tblObserved.add(tblEl.value);
    tblObserver.observe(tblEl.value);
  }
}

function columnVisible(c: TableColumn): boolean {
  return !(hiddenCols[c.key] ?? c.hidden === true);
}

function toggleColumn(c: TableColumn) {
  hiddenCols[c.key] = columnVisible(c);
}

function showAllColumns() {
  for (const key of Object.keys(hiddenCols)) hiddenCols[key] = false;
}

function resetWidths() {
  for (const key of Object.keys(widths)) delete widths[key];
  for (const c of visibleVars()) {
    if (contentWidths[c.key] !== undefined) varWidths[c.key] = contentWidths[c.key];
  }
  distribute();
  emitColumns();
}

function openColMenu(e: MouseEvent, c: TableColumn) {
  colMenu.value = {
    key: c.key,
    x: Math.min(e.clientX, window.innerWidth - 230),
    y: Math.min(e.clientY, window.innerHeight - 260),
  };
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
  const gq = globalQuery.value.trim().toLowerCase();
  const out: Array<{ row: Record<string, unknown>; index: number }> = [];
  props.rows.forEach((row, index) => {
    if (gq && !visibleColumns.value.some((c) => valueText(row[c.key]).toLowerCase().includes(gq))) return;
    for (const c of visibleColumns.value) {
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
  const el = e.target as HTMLElement | null;
  if (colMenu.value && !el?.closest('.sf-tbl-colmenu')) colMenu.value = null;
  if (!openFilter.value) return;
  if (el?.closest('.sf-tbl-pop') || el?.closest('.sf-tbl-hbtn')) return;
  openFilter.value = null;
}

function emitColumns() {
  emit(
    'update:columns',
    props.columns.map((c) => ({
      ...c,
      hidden: !columnVisible(c),
      width: widths[c.key] ?? c.width,
    })),
  );
}

function startResize(e: PointerEvent, c: TableColumn) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const vis = visibleColumns.value;
  const idx = vis.findIndex((col) => col.key === c.key);
  if (idx < 0) return;
  const below = vis.slice(idx + 1).filter(isVarColumn);
  if (!below.length) return;
  const handle = e.currentTarget as HTMLElement;
  const startX = e.clientX;
  const dragged = isVarColumn(c);
  const min = c.min ?? 48;
  const max = c.max ?? Number.POSITIVE_INFINITY;
  const startW = dragged ? (varWidths[c.key] ?? min) : (widths[c.key] ?? c.width ?? min);
  const base = new Map(below.map((col) => [col.key, varWidths[col.key] ?? col.min ?? 48]));
  const onMove = (ev: PointerEvent) => {
    const delta = Math.round(ev.clientX - startX);
    for (const col of below) varWidths[col.key] = base.get(col.key) ?? 48;
    const setWidth = (w: number) => {
      if (dragged) varWidths[c.key] = w;
      else widths[c.key] = Math.round(w);
    };
    if (delta > 0) {
      const freed = squeezeVars(below, delta, base);
      setWidth(Math.min(max, startW + freed));
    } else if (delta < 0) {
      const target = Math.max(min, startW + delta);
      const freed = startW - target;
      setWidth(target);
      const first = below[0];
      varWidths[first.key] = (base.get(first.key) ?? 48) + freed;
    }
  };
  const onUp = () => {
    handle.releasePointerCapture(e.pointerId);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    emitColumns();
  };
  handle.setPointerCapture(e.pointerId);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
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
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown);
  sizerObserver.disconnect();
});
</script>

<template>
  <div class="sf-tbl-wrap">
    <div v-if="searchable || hasToolbarSides" class="sf-tbl-search">
      <div v-if="hasLeadSlot" class="sf-tbl-search-side">
        <slot name="search-lead" />
      </div>
      <div class="sf-tbl-search-box">
        <input
          v-if="searchable"
          v-model="globalQuery"
          class="sf-tbl-search-input"
          type="text"
          :placeholder="searchPlaceholder"
        >
        <button
          v-if="searchable && globalQuery"
          class="sf-tbl-search-clear"
          type="button"
          title="Clear"
          @click="globalQuery = ''"
        >✕</button>
      </div>
      <div v-if="hasEndSlot" class="sf-tbl-search-side sf-tbl-search-side--end">
        <slot name="search-end" :filtered="visibleRows.length" :total="props.rows.length" />
      </div>
    </div>
    <div class="sf-tbl-scroll">
      <div
        :ref="setTblEl"
        class="sf-tbl"
        :class="{ 'sf-tbl--m-lead': mobileLead, 'sf-tbl--m-sub': mobileSub }"
      >
    <div class="sf-tbl-head">
      <div v-if="rowNumbers" class="sf-tbl-th sf-tbl-gutter"><span class="sf-tbl-hlabel">#</span></div>
      <div
        v-for="(c, ci) in visibleColumns"
        :key="c.key"
        :ref="(el) => setHeadRef(c.key, el)"
        class="sf-tbl-th"
        :class="{ 'sf-tbl-th--active': filterActive(c) || sort?.key === c.key }"
        :data-col="c.key"
        :style="{ justifyContent: cellJustify(c) }"
        @contextmenu.prevent="openColMenu($event, c)"
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
          v-if="ci < visibleColumns.length - 1 && handleFlags[ci]"
          class="sf-tbl-resize"
          title="Drag to resize"
          @pointerdown="startResize($event, c)"
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
      <div v-if="hasActions" class="sf-tbl-th sf-tbl-th--actions" />
    </div>
    <div
      v-if="hasActions && visibleRows.length"
      :ref="setSizerEl"
      class="sf-tbl-sizer"
      aria-hidden="true"
    >
      <slot name="actions" :row="visibleRows[0].row" />
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
        v-for="c in visibleColumns"
        :key="c.key"
        class="sf-tbl-cell"
        :class="`sf-tbl-c--${c.mobile ?? 'hidden'}`"
        :style="{ justifyContent: cellJustify(c) }"
        :data-col="c.key"
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
    <div
      v-if="colMenu"
      class="sf-tbl-colmenu"
      :style="{ left: `${colMenu.x}px`, top: `${colMenu.y}px` }"
      @pointerdown.stop
      @contextmenu.prevent.stop
    >
      <div class="sf-tbl-colmenu-head">Columns</div>
      <label v-for="c in columns" :key="c.key" class="sf-tbl-chk">
        <input type="checkbox" :checked="columnVisible(c)" @change="toggleColumn(c)">
        <span class="sf-tbl-chk-val">{{ c.label }}</span>
      </label>
      <div class="sf-tbl-colmenu-sep" />
      <button class="sf-tbl-colmenu-act" type="button" @click="showAllColumns(); colMenu = null">Show all columns</button>
      <button class="sf-tbl-colmenu-act" type="button" @click="resetWidths(); colMenu = null">Reset column widths</button>
    </div>
  </div>
    </div>
  </div>
</template>

<style scoped>
.sf-tbl-wrap {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.sf-tbl-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

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

.sf-tbl-search {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  flex-shrink: 0;
  background: var(--sf-bg-lighter);
  border-right: 1px solid var(--sf-border);
  border-bottom: 1px solid var(--sf-border);
}

.sf-tbl-search-box {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--sf-bg);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
}

.sf-tbl-search-box:focus-within {
  border-color: var(--sf-accent);
}

.sf-tbl-search-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 13px;
  padding: 3px 26px 3px 8px;
  outline: none;
}

.sf-tbl-search-clear {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
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
  .sf-tbl-search-clear:hover {
    color: var(--sf-text);
    background: var(--sf-hover-overlay);
  }
}

.sf-tbl-search-side {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sf-tbl-search-side--end {
  margin-left: auto;
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
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--sf-bg);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
}

.sf-tbl-pop-search:focus-within {
  border-color: var(--sf-accent);
}

.sf-tbl-pop-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  border-radius: var(--sf-radius-sm);
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 13px;
  padding: 3px 26px 3px 8px;
  outline: none;
}

.sf-tbl-pop-clear {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
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
  position: fixed;
  top: 0;
  left: -9999px;
  display: flex;
  gap: 4px;
  padding: 0 4px;
  visibility: hidden;
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

.sf-tbl-colmenu {
  position: fixed;
  z-index: 30;
  display: flex;
  flex-direction: column;
  min-width: 190px;
  max-width: 260px;
  max-height: 320px;
  overflow: auto;
  padding: 6px;
  background: var(--sf-bg-lighter);
  border: 1px solid var(--sf-border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}

.sf-tbl-colmenu-head {
  padding: 2px 4px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--sf-text-muted);
}

.sf-tbl-colmenu-sep {
  border-top: 1px solid var(--sf-border);
  margin: 4px 0;
}

.sf-tbl-colmenu-act {
  background: none;
  border: none;
  border-radius: var(--sf-radius-sm);
  color: var(--sf-text);
  cursor: pointer;
  font-family: var(--sf-font);
  font-size: 13px;
  padding: 4px;
  text-align: left;
}

@media (hover: hover) {
  .sf-tbl-colmenu-act:hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
  }
}

.sf-root--mobile .sf-tbl-scroll {
  overflow-x: hidden;
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

.sf-root--mobile .sf-tbl-search {
  height: 60px;
  padding: 0 12px;
  gap: 10px;
}

.sf-root--mobile .sf-tbl-search-box {
  min-height: 44px;
}

.sf-root--mobile .sf-tbl-search-input {
  font-size: 16px;
  padding: 8px 46px 8px 12px;
}

.sf-root--mobile .sf-tbl-search-clear {
  width: 40px;
  height: 40px;
  right: 2px;
  font-size: 18px;
}

.sf-root--mobile .sf-tbl-search-side :slotted(.sf-tbl-btn) {
  width: 44px;
  height: 44px;
  padding: 0;
}

.sf-root--mobile .sf-tbl {
  min-height: calc(100% + 1px);
}
</style>
