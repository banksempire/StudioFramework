<script setup lang="ts">
import { computed, ref } from 'vue';
import { useWorkspaceContext } from '../composables/useWorkspace';
import type { WorkspaceSnapshot } from '../workspace/snapshots';

/**
 * Workspace app panel — save / switch / manage named workspaces.
 *
 * Framework-generic: it only talks to the workspace API + localStorage,
 * so any host app can register it (docker app → { type: 'component',
 * key: 'workspace-panel' }) and get workspace management for free.
 *
 * - Save: captures the current tile structure + spacing as a snapshot.
 * - Load: restores structure + spacing exactly; tabs without a definition
 *   (deleted windows) keep their slot and render the built-in blank page.
 * - Manage: rename, delete, search, reorder (↑/↓).
 * - All saved workspaces live in localStorage (survive refresh, no backend).
 */

interface SavedWorkspace {
  id: string;
  name: string;
  savedAt: number;
  snapshot: WorkspaceSnapshot;
}

const STORAGE_KEY = 'sf.workspaces';

const ws = useWorkspaceContext();

function loadSaved(): SavedWorkspace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // storage unavailable / corrupt — start fresh
  }
}

const saved = ref<SavedWorkspace[]>(loadSaved());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.value));
  } catch {
    /* storage unavailable */
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Formatted timestamps are cached per item: the list re-renders on every
// search keystroke, and toLocaleString is far from free.
const timeCache = new Map<string, string>();

function fmtTime(item: SavedWorkspace): string {
  let s = timeCache.get(item.id);
  if (s === undefined) {
    try {
      s = new Date(item.savedAt).toLocaleString();
    } catch {
      s = '';
    }
    timeCache.set(item.id, s);
  }
  return s;
}

// ── Save current workspace ────────────────────────────────────────────────

const nameInput = ref('');
const saveError = ref('');
/** load failures (corrupt stored snapshots) — shown near the list */
const loadError = ref('');

function autoName(): string {
  let max = 0;
  for (const s of saved.value) {
    const m = /(\d+)\s*$/.exec(s.name);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `Workspace ${max + 1}`;
}

function saveCurrent() {
  const name = nameInput.value.trim() || autoName();
  if (saved.value.some((s) => s.name === name)) {
    saveError.value = `"${name}" already exists`;
    return;
  }
  saved.value.unshift({ id: newId(), name, savedAt: Date.now(), snapshot: ws.capture() });
  saveError.value = '';
  nameInput.value = '';
  persist();
}

// ── Search ────────────────────────────────────────────────────────────────

const query = ref('');

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? saved.value.filter((s) => s.name.toLowerCase().includes(q)) : saved.value;
});

// ── Load / rename / delete / reorder ─────────────────────────────────────

/** Number of ghost (blank) windows created by the last load — shown as a
 *  note so missing windows are never silent. */
const lastGhostCount = ref(0);

function loadWorkspace(item: SavedWorkspace) {
  try {
    lastGhostCount.value = ws.apply(item.snapshot).length;
  } catch {
    // A hand-edited/corrupt stored snapshot must not take the panel down.
    loadError.value = `Could not load "${item.name}" (corrupt snapshot)`;
  }
}

const editingId = ref<string | null>(null);
const editName = ref('');

function startRename(item: SavedWorkspace) {
  editingId.value = item.id;
  editName.value = item.name;
}

function commitRename() {
  const id = editingId.value;
  editingId.value = null;
  if (!id) return;
  const item = saved.value.find((s) => s.id === id);
  const name = editName.value.trim();
  if (item && name) {
    item.name = name;
    persist();
  }
}

function removeItem(id: string) {
  saved.value = saved.value.filter((s) => s.id !== id);
  timeCache.delete(id);
  persist();
}

function moveItem(id: string, dir: -1 | 1) {
  const i = saved.value.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= saved.value.length) return;
  const arr = [...saved.value];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  saved.value = arr;
  persist();
}
</script>

<template>
  <div class="sf-ws-panel">
    <!-- Save current workspace -->
    <div class="sf-ws-save">
      <input
        v-model="nameInput"
        class="sf-ws-input"
        placeholder="Workspace name…"
        @keydown.enter="saveCurrent"
      />
      <button class="sf-ws-btn sf-ws-btn--primary" title="Save the current workspace layout" @click="saveCurrent">
        Save
      </button>
    </div>
    <div v-if="saveError" class="sf-ws-error">{{ saveError }}</div>

    <!-- Search -->
    <input v-model="query" class="sf-ws-input sf-ws-search" placeholder="Search workspaces…" />
    <div v-if="loadError" class="sf-ws-error">{{ loadError }}</div>

    <!-- Saved list -->
    <div v-if="saved.length === 0" class="sf-ws-empty">
      No saved workspaces yet.<br />
      Arrange tiles the way you like, then Save —<br />
      load it back anytime, even after a refresh.
    </div>
    <div v-else class="sf-ws-list">
      <div
        v-for="(item, i) in filtered"
        :key="item.id"
        class="sf-ws-item"
        :title="'Double-click to load'"
        @dblclick="loadWorkspace(item)"
      >
        <template v-if="editingId === item.id">
          <input
            v-model="editName"
            class="sf-ws-input sf-ws-rename"
            autofocus
            @keydown.enter="commitRename"
            @keydown.esc="editingId = null"
            @blur="commitRename"
          />
        </template>
        <template v-else>
          <div class="sf-ws-item-main">
            <span class="sf-ws-name">{{ item.name }}</span>
            <span class="sf-ws-time">{{ fmtTime(item) }}</span>
          </div>
          <div class="sf-ws-actions">
            <button class="sf-ws-btn" title="Load this workspace" @click="loadWorkspace(item)">▶</button>
            <button class="sf-ws-btn" title="Rename" @click="startRename(item)">✎</button>
            <button class="sf-ws-btn" title="Move up" :disabled="i === 0" @click="moveItem(item.id, -1)">↑</button>
            <button class="sf-ws-btn" title="Move down" :disabled="i === filtered.length - 1" @click="moveItem(item.id, 1)">↓</button>
            <button class="sf-ws-btn" title="Delete" @click="removeItem(item.id)">🗑</button>
          </div>
        </template>
      </div>
    </div>

    <div v-if="lastGhostCount > 0" class="sf-ws-ghosts">
      {{ lastGhostCount }} unavailable window{{ lastGhostCount === 1 ? '' : 's' }} — shown blank
    </div>
  </div>
</template>

<style scoped>
.sf-ws-panel {
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sf-ws-save {
  display: flex;
  gap: 6px;
}

.sf-ws-input {
  flex: 1;
  min-width: 0;
  background: var(--sf-bg);
  color: var(--sf-text);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  padding: 3px 6px;
  font-size: 16px;
  font-family: var(--sf-font);
  outline: none;
}

.sf-ws-input:focus {
  border-color: var(--sf-accent);
}

.sf-ws-search {
  flex: none;
}

.sf-ws-btn {
  background: var(--sf-bg-light);
  color: var(--sf-text);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  padding: 2px 7px;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.sf-ws-btn:hover {
  background: var(--sf-bg-lighter);
}

.sf-ws-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.sf-ws-btn--primary {
  background: var(--sf-accent);
  border-color: var(--sf-accent);
  color: var(--sf-text-on-accent);
}

.sf-ws-btn--primary:hover {
  background: var(--sf-accent-dim);
}

.sf-ws-error {
  color: var(--sf-danger);
  font-size: 16px;
}

.sf-ws-empty {
  color: var(--sf-text-muted);
  font-size: 16px;
  line-height: 1.5;
}

.sf-ws-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sf-ws-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: var(--sf-radius-sm);
  cursor: pointer;
}

.sf-ws-item:hover {
  box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
}

.sf-ws-item-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.sf-ws-name {
  color: var(--sf-text-bright);
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sf-ws-time {
  color: var(--sf-text-muted);
  font-size: 16px;
  flex-shrink: 0;
}

.sf-ws-actions {
  display: flex;
  gap: 4px;
}

.sf-ws-rename {
  width: 100%;
}

.sf-ws-ghosts {
  color: var(--sf-text-muted);
  font-size: 16px;
  border-top: 1px solid var(--sf-border);
  padding-top: 4px;
}
</style>
