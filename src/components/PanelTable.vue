<script setup lang="ts">
import { computed } from 'vue';
import type { PanelTableColumn, PanelTableRow } from '../types/panel';
import type { TableColumn } from '../types/table';
import Table from './Table.vue';

const props = defineProps<{
  columns: PanelTableColumn[];
  rows: PanelTableRow[];
  empty?: string;
  resizable?: boolean;
}>();

const tableColumns = computed<TableColumn[]>(() =>
  props.columns.map((c) => ({ key: c.key, label: c.label, min: c.min, mobile: c.mobile })),
);

const tableRows = computed(() => props.rows.map((r) => ({ ...r.cells, __id: r.id })));

function cellClass(col: PanelTableColumn, row: Record<string, unknown>): string[] {
  const value = row[col.key];
  if (!col.kind || value === undefined || value === null || value === '') return [];
  const out = [`sf-pt-cell--${col.kind}`];
  if (col.kind === 'status') out.push(`sf-pt-cell--s-${String(value)}`);
  return out;
}

function cellTitle(row: Record<string, unknown>, col: PanelTableColumn): string | undefined {
  const src = props.rows.find((r) => r.id === row.__id);
  return src?.titles?.[col.key];
}
</script>

<template>
  <div class="sf-pt">
    <Table
      :columns="tableColumns"
      :rows="tableRows"
      row-key="__id"
      :resizable="resizable ?? true"
      :empty-text="empty ?? 'No rows.'"
    >
      <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="{ row }">
        <span
          class="sf-pt-cell"
          :class="cellClass(col, row)"
          :data-cell="col.key"
          :title="cellTitle(row, col)"
        >{{ row[col.key] || '—' }}</span>
      </template>
    </Table>
  </div>
</template>
