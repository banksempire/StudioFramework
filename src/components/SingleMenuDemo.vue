<script setup lang="ts">
import { ref } from 'vue';
import type { SingleMenuOption } from '../types/singleMenu';
import SingleMenu from './SingleMenu.vue';

interface RecentFile {
  id: string;
  name: string;
  kind: string;
}

const files = ref<RecentFile[]>([
  { id: 'welcome', name: 'welcome.md', kind: 'markdown' },
  { id: 'layout', name: 'framework.layout.json', kind: 'json' },
  { id: 'single-menu', name: 'SingleMenu.vue', kind: 'vue' },
  { id: 'notes', name: 'notes.txt', kind: 'text' },
  { id: 'scratch', name: 'scratch.txt', kind: 'text' },
]);

const lastAction = ref('');

function optionsOf(f: RecentFile): SingleMenuOption[] {
  if (f.id === 'scratch' || f.id === 'notes')
    return [{ id: 'delete', label: 'Delete', icon: '🗑', danger: true }];
  return [
    { id: 'open', label: 'Open', icon: '📄' },
    { id: 'rename', label: 'Rename', icon: '✎' },
    { id: 'delete', label: 'Delete', icon: '🗑', danger: true },
  ];
}

const renamingId = ref<string | null>(null);
const renameDraft = ref('');
const renameEl = ref<HTMLInputElement | null>(null);

function startRename(f: RecentFile) {
  renamingId.value = f.id;
  renameDraft.value = f.name;
  requestAnimationFrame(() => renameEl.value?.focus());
}

function commitRename(f: RecentFile) {
  const name = renameDraft.value.trim();
  if (name && renamingId.value === f.id) f.name = name;
  renamingId.value = null;
}

function onSelect(f: RecentFile, opt: SingleMenuOption) {
  if (opt.id === 'rename') {
    startRename(f);
    lastAction.value = `rename ${f.name}`;
  } else if (opt.id === 'delete') {
    files.value = files.value.filter((x) => x.id !== f.id);
    lastAction.value = `delete ${f.name}`;
  } else {
    lastAction.value = `${opt.id} ${f.name}`;
  }
}

function onActivate(f: RecentFile) {
  lastAction.value = `open ${f.name}`;
}
</script>

<template>
  <div class="single-menu-demo">
    <SingleMenu
      class="single-menu-demo-list"
      :items="files"
      :options="optionsOf"
      :key-of="(f: RecentFile) => f.id"
      :title-of="(f: RecentFile) => f.name"
      @activate="onActivate"
      @select="onSelect"
    >
      <template #item="{ item: f }">
        <div v-if="renamingId === f.id" class="single-menu-demo-rename" @click.stop>
          <input
            ref="renameEl"
            v-model="renameDraft"
            class="single-menu-demo-input"
            @keydown.enter.prevent="commitRename(f)"
            @keydown.escape.prevent="renamingId = null"
            @blur="commitRename(f)"
          />
        </div>
        <div v-else class="single-menu-demo-item">
          <span class="single-menu-demo-name">{{ f.name }}</span>
          <span class="single-menu-demo-kind">{{ f.kind }}</span>
        </div>
      </template>
    </SingleMenu>
    <div class="single-menu-demo-status">{{ lastAction || 'right-click a row (mouse) — tap ⋮ (touch)' }}</div>
  </div>
</template>

<style scoped>
.single-menu-demo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 2px;
}

.single-menu-demo-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 6px;
  cursor: pointer;
}

.single-menu-demo-item:hover {
  box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
}

.single-menu-demo-name {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  color: var(--sf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.single-menu-demo-kind {
  font-size: 16px;
  color: var(--sf-text-muted);
  flex-shrink: 0;
}

.single-menu-demo-rename {
  padding: 2px 4px;
}

.single-menu-demo-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 16px;
  font-family: var(--sf-mono);
  color: var(--sf-text);
  background: var(--sf-bg);
  border: 1px solid var(--sf-accent);
  border-radius: var(--sf-radius-sm);
  padding: 2px 6px;
  outline: none;
}

.single-menu-demo-status {
  font-size: 16px;
  color: var(--sf-text-muted);
  padding: 2px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
