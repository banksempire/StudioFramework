<script setup lang="ts">
import { ref } from 'vue';
import type { PanelListBulk, PanelListItem } from '../types/panel';
import PanelList from './PanelList.vue';

interface Task {
  id: string;
  name: string;
  size: string;
  pinned: boolean;
}

const tasks = ref<Task[]>([
  { id: 'alpha', name: 'alpha.log', size: '12 KB', pinned: false },
  { id: 'bravo', name: 'bravo.csv', size: '4 MB', pinned: false },
  { id: 'charlie', name: 'charlie.txt', size: '318 B', pinned: true },
  { id: 'delta', name: 'delta.json', size: '88 KB', pinned: false },
  { id: 'echo', name: 'echo.ndjson', size: '1.2 MB', pinned: false },
]);

const bulkOn = ref(false);
const selected = ref<string[]>([]);
const lastAction = ref('');

function rows(): PanelListItem[] {
  return tasks.value.map((t): PanelListItem => {
    const source = store_feeds.get(t.id);
    return {
      id: t.id,
      label: t.name,
      meta: t.size,
      detail: t.pinned ? 'pinned' : 'task',
      action: 'task-open',
      options: [{ id: 'remove', label: 'Remove', icon: '🗑', danger: true }],
      ...(source ? { note: source } : {}),
    };
  });
}

const store_feeds = new Map<string, string>([['bravo', 'touched']]);

function bulk(): PanelListBulk {
  const n = selected.value.length;
  return {
    active: bulkOn.value,
    selected: selected.value,
    entry: { id: 'edit', label: 'Edit', icon: '✎' },
    actions: [
      { id: 'pin', label: n ? `Pin (${n})` : 'Pin', icon: 'pin', disabled: n === 0 },
      { id: 'delete', label: n ? `Delete (${n})` : 'Delete', icon: '🗑', danger: true, disabled: n === 0 },
      { id: 'done', label: 'Done' },
    ],
  };
}

function reorder(fromId: string, toId: string) {
  const ids = tasks.value.map((t) => t.id);
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  const byId = new Map(tasks.value.map((t) => [t.id, t]));
  tasks.value = ids.map((id) => byId.get(id) as Task);
  lastAction.value = `reorder ${fromId}->${toId}`;
}
</script>

<template>
  <div class="bulk-list-demo">
    <p class="bulk-list-demo-status">{{ lastAction || 'idle' }} ({{ tasks.length }})</p>
    <PanelList
      :items="rows()"
      :bulk="bulk()"
      @bulk-entry="
        () => {
          bulkOn = true;
          selected = [];
          lastAction = 'enter bulk';
        }
      "
      @bulk-action="
        (id) => {
          if (id === 'done') {
            bulkOn = false;
            selected = [];
          } else if (id === 'pin') {
            tasks = tasks.map((t) => (selected.includes(t.id) ? { ...t, pinned: true } : t));
          } else if (id === 'delete') {
            tasks = tasks.filter((t) => !selected.includes(t.id));
          }
          lastAction = `${id} ${selected.join(',')}`;
        }
      "
      @bulk-change="
        (ids) => {
          selected = ids;
          lastAction = `toggle ${ids.length}`;
        }
      "
      @bulk-reorder="reorder"
    />
  </div>
</template>
