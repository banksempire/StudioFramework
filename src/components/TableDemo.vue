<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { TableColumn } from '../types/table';
import SvgIcon from './SvgIcon.vue';
import Table from './Table.vue';

const files = reactive([
  { name: 'report-final.md', kind: 'doc', size: 48, days: 'Mon–Fri', note: 'release notes' },
  { name: 'budget.xlsx', kind: 'sheet', size: 312, days: 'Mon–Fri', note: '2026 plan' },
  { name: 'avatar.png', kind: 'image', size: 96, days: 'daily', note: '' },
  { name: 'index.ts', kind: 'code', size: 12, days: 'Mon–Fri', note: 'entry point' },
  { name: 'archive.zip', kind: 'image', size: 2048, days: 'weekend', note: 'old backup' },
]);

const fileColumns = ref<TableColumn[]>([
  { key: 'name', label: 'Name', fixedWidth: 150, sortable: true, filter: true, mobile: 'title' },
  { key: 'kind', label: 'Kind', fixedWidth: 80, sortable: true, filter: true },
  { key: 'size', label: 'Size KB', fixedWidth: 76, sortable: true, align: 'right', mobile: 'sub' },
  { key: 'days', label: 'Days', sortable: true, filter: 'select' },
  { key: 'note', label: 'Note' },
]);

const state = reactive({ edits: 0, removed: '', widths: '', clicked: '', selKey: '' });

function removeFile(row: Record<string, unknown>) {
  const i = files.findIndex((f) => f.name === row.name);
  if (i >= 0) files.splice(i, 1);
  state.removed = String(row.name);
}

const jobs = reactive([
  { id: 'a1', model: 'beta/pro-1', window: '(UTC+8) 14:00-18:00', on: true },
  { id: 'a2', model: 'beta/lite', window: '(UTC) 22:00-02:00', on: false },
  { id: 'a3', model: 'gamma/xl', window: '(UTC+2) 09:00-17:00', on: true },
  { id: 'a4', model: 'beta/pro-2', window: '(UTC+8) 09:00-12:00', on: false },
  { id: 'a5', model: 'delta/mini', window: '(UTC-5) 07:00-10:00', on: true },
  { id: 'a6', model: 'gamma/xl-2', window: '(UTC+2) 20:00-23:00', on: true },
  { id: 'a7', model: 'beta/lite-2', window: '(UTC) 01:00-05:00', on: false },
  { id: 'a8', model: 'delta/max', window: '(UTC-5) 18:00-22:00', on: true },
  { id: 'a9', model: 'gamma/mini', window: '(UTC+2) 11:00-15:00', on: false },
  { id: 'a10', model: 'beta/pro-3', window: '(UTC+8) 16:00-20:00', on: true },
  { id: 'a11', model: 'delta/lite', window: '(UTC-5) 05:00-08:00', on: true },
  { id: 'a12', model: 'gamma/pro', window: '(UTC+2) 13:00-17:00', on: false },
]);

const jobColumns: TableColumn[] = [
  { key: 'on', label: 'On', fixedWidth: 40, mobile: 'lead' },
  { key: 'model', label: 'Model', sortable: true, mobile: 'title' },
  { key: 'window', label: 'Window', fixedWidth: 160, mobile: 'sub' },
];

function onColumns(cols: TableColumn[]) {
  state.widths = cols.map((c) => `${c.key}:${c.fixedWidth ?? 'auto'}`).join(' ');
}

const fileRows = computed(() => files as Array<Record<string, unknown>>);
</script>

<template>
  <div class="sf-table-demo">
    <div class="sf-table-demo-block">
      <div class="sf-table-demo-caption">files — sort · filter · resize · actions</div>
      <Table
        :columns="fileColumns"
        :rows="fileRows"
        row-key="name"
        row-numbers
        searchable
        search-placeholder="Search files…"
        :row-title="(row) => String(row.name)"
        :row-class="(row) => ({ 'sf-table-demo--sel': row.name === state.selKey })"
        empty-text="No files."
        @row-click="(row) => ((state.clicked = String(row.name)), (state.selKey = String(row.name)))"
        @update:columns="onColumns"
      >
        <template #search-lead>
          <button class="sf-tbl-btn" type="button" title="New file" @click="state.edits += 1">
            <SvgIcon name="＋" />
          </button>
        </template>
        <template #search-end="{ filtered, total }">{{ filtered }}/{{ total }}</template>
        <template #cell-days="{ value }">
          <span class="sf-table-demo-days">{{ value }}</span>
        </template>
        <template #empty="{ filtered }">{{ filtered ? 'No files match.' : 'No files.' }}</template>
        <template #cell-name="{ row }">
          <span class="sf-table-demo-key">{{ row.name }}</span>
        </template>
        <template #actions="{ row }">
          <button
            class="sf-tbl-btn"
            type="button"
            title="Edit"
            @click.stop="state.edits += 1"
          >
            <SvgIcon name="✎" />
          </button>
          <button
            class="sf-tbl-btn sf-tbl-btn--danger"
            type="button"
            title="Delete"
            @click.stop="removeFile(row)"
          >
            <SvgIcon name="✕" />
          </button>
        </template>
      </Table>
    </div>
    <div class="sf-table-demo-block sf-table-demo-block--cap">
      <div class="sf-table-demo-caption">jobs — capped height: header stays, only rows scroll</div>
      <Table
        :columns="jobColumns"
        :rows="jobs"
        row-key="id"
        searchable
        search-placeholder="Search jobs…"
      >
        <template #cell-on="{ row }">
          <button
            class="sf-table-demo-switch"
            :class="{ 'sf-table-demo-switch--on': row.on }"
            type="button"
            role="switch"
            :aria-checked="row.on === true"
            @click.stop="row.on = !row.on"
          ><span /></button>
        </template>
        <template #actions="{ row }">
          <button class="sf-tbl-btn" type="button" title="Edit" @click.stop>
            <SvgIcon name="✎" />
          </button>
        </template>
      </Table>
    </div>
    <div class="sf-table-demo-state">
      edits={{ state.edits }} · removed={{ state.removed || '—' }} · clicked={{ state.clicked || '—' }} ·
      [{{ state.widths || 'widths untouched' }}]
    </div>
  </div>
</template>

<style scoped>
.sf-table-demo {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 14px 18px;
  font-size: 13px;
  max-width: 720px;
}

.sf-table-demo-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.sf-table-demo-block:last-of-type {
  max-width: 480px;
}

.sf-table-demo-caption {
  opacity: 0.7;
}

.sf-table-demo-key {
  font-weight: 600;
}

.sf-table-demo-block--cap {
  height: 300px;
  display: flex;
  flex-direction: column;
}

.sf-table-demo-days {
  font-variant-numeric: tabular-nums;
}

.sf-table-demo--sel {
  background: var(--sf-selection);
}

.sf-table-demo-switch {
  position: relative;
  width: 30px;
  height: 16px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--sf-border);
  background: var(--sf-bar);
  cursor: pointer;
}

.sf-table-demo-switch span {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--sf-text-muted);
  transition: transform 0.15s;
}

.sf-table-demo-switch--on {
  background: var(--sf-accent);
  border-color: var(--sf-accent);
}

.sf-table-demo-switch--on span {
  transform: translateX(14px);
  background: var(--sf-text-on-accent);
}

.sf-table-demo-state {
  opacity: 0.6;
  font-family: var(--sf-font-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
