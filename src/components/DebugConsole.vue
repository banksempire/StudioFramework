<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { DebugLogLevel } from '../debug/debugLog';
import { clearDebugLogs, debugLogs, formatEntryText, formatLogTime, levelRank } from '../debug/debugLog';

type Filter = 'all' | DebugLogLevel;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'debug', label: 'Debug' },
  { id: 'info', label: 'Info' },
  { id: 'warn', label: 'Warn' },
  { id: 'error', label: 'Error' },
];

const open = ref(false);
const filter = ref<Filter>('all');
const copied = ref(false);
const listEl = ref<HTMLElement | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const entries = computed(() => debugLogs.value);
const errorCount = computed(() => entries.value.filter((e) => e.level === 'error').length);

const filtered = computed(() => {
  const logs = entries.value;
  if (filter.value === 'all') return logs;
  const min = levelRank(filter.value);
  return logs.filter((e) => levelRank(e.level) >= min);
});

watch(
  () => entries.value.length,
  async () => {
    if (!open.value) return;
    const el = listEl.value;
    if (!el) return;
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    if (!pinned) return;
    await nextTick();
    el.scrollTop = el.scrollHeight;
  },
);

async function copyFiltered() {
  const text = filtered.value.map(formatEntryText).join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  copied.value = true;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = false), 1500);
}

function onDocClick(e: MouseEvent) {
  if (!(e.target instanceof Element) || !e.target.closest('.sf-debug-toggle')) {
    open.value = false;
  }
}
function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}
watch(open, (v) => {
  if (v) {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    void nextTick(() => {
      const el = listEl.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  } else {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onEsc);
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onEsc);
  if (copiedTimer) clearTimeout(copiedTimer);
});
</script>

<template>
  <span
    class="sf-debug-toggle"
    :class="{ 'sf-debug-toggle--open': open }"
    title="Debug log — ?debug mode"
    @click.stop="open = !open"
  >
    <span class="sf-debug-toggle-icon">🐞</span>
    <span class="sf-debug-toggle-label">Debug</span>
    <span v-if="errorCount > 0" class="sf-debug-toggle-badge">{{ errorCount }}</span>
    <div v-if="open" class="sf-debug-pop" @click.stop>
      <div class="sf-debug-pop-head">
        <span class="sf-debug-pop-title">Debug log</span>
        <select v-model="filter" class="sf-debug-filter" title="Screen log entries by level">
          <option v-for="f in FILTERS" :key="f.id" :value="f.id">{{ f.label }}</option>
        </select>
        <button class="sf-debug-btn" type="button" @click="copyFiltered">
          {{ copied ? 'Copied ✓' : 'Copy' }}
        </button>
        <button class="sf-debug-btn" type="button" title="Clear all log entries" @click="clearDebugLogs()">
          Clear
        </button>
      </div>
      <div ref="listEl" class="sf-debug-log">
        <div v-if="filtered.length === 0" class="sf-debug-empty">no log entries</div>
        <div
          v-for="e in filtered"
          :key="e.id"
          class="sf-debug-row"
          :class="`sf-debug-row--${e.level}`"
        >
          <span class="sf-debug-row-time">{{ formatLogTime(e.time) }}</span>
          <span class="sf-debug-row-level">{{ e.level }}</span>
          <span class="sf-debug-row-msg">{{ e.message }}</span>
        </div>
      </div>
      <div class="sf-debug-pop-foot">
        {{ filtered.length }} of {{ entries.length }} entries · level ≥ {{ filter }}
      </div>
    </div>
  </span>
</template>
