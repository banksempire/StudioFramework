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
          :class="[
            col.kind ? `sf-pt-cell--${col.kind}` : '',
            col.kind === 'status' ? `sf-pt-cell--s-${String(row[col.key] ?? '')}` : '',
          ]"
          :title="cellTitle(row, col)"
        >{{ row[col.key] ?? '—' }}</span>
      </template>
    </Table>
  </div>
</template>
