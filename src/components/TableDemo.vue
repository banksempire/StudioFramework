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
  { key: 'name', label: 'Name', width: 150, sortable: true, filter: 'text', mobile: 'title' },
  { key: 'kind', label: 'Kind', width: 80, sortable: true, filter: 'select' },
  { key: 'size', label: 'Size KB', width: 76, sortable: true, align: 'right', mobile: 'sub' },
  { key: 'days', label: 'Days', width: 90, sortable: true, filter: 'select' },
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
]);

const jobColumns: TableColumn[] = [
  { key: 'on', label: 'On', width: 40, mobile: 'lead' },
  { key: 'model', label: 'Model', sortable: true, mobile: 'title' },
  { key: 'window', label: 'Window', width: 160, mobile: 'sub' },
];

function onColumns(cols: TableColumn[]) {
  state.widths = cols.map((c) => `${c.key}:${c.width ?? 'auto'}`).join(' ');
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
        :row-title="(row) => String(row.name)"
        :row-class="(row) => ({ 'sf-table-demo--sel': row.name === state.selKey })"
        empty-text="No files."
        @row-click="(row) => ((state.clicked = String(row.name)), (state.selKey = String(row.name)))"
        @update:columns="onColumns"
      >
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
    <div class="sf-table-demo-block">
      <div class="sf-table-demo-caption">jobs — mobile card layout (lead · title · sub)</div>
      <Table :columns="jobColumns" :rows="jobs" row-key="id">
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
