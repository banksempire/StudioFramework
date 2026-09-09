<script setup lang="ts">
import { ref } from 'vue';
import type { KeyValueItem } from '../types/panel';

const props = defineProps<{
  items: KeyValueItem[];
  empty?: string;
}>();

const copiedIndex = ref<number | null>(null);
let copyTimer: number | undefined;

function legacyCopy(text: string, done: () => void) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch {}
}

function copyRow(item: KeyValueItem, index: number) {
  const text = `${item.key}: ${item.title ?? item.value ?? ''}`;
  const done = () => {
    copiedIndex.value = index;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      copiedIndex.value = null;
    }, 1200);
  };
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(done)
        .catch(() => legacyCopy(text, done));
      return;
    }
  } catch {}
  legacyCopy(text, done);
}

function copyTitle(item: KeyValueItem): string {
  return `Click to copy: ${item.key}: ${item.title ?? item.value ?? ''}`;
}
</script>

<template>
  <div v-if="props.items.length === 0 && props.empty" class="sf-empty">{{ props.empty }}</div>
  <div v-else class="kv-list">
    <template v-for="(item, i) in props.items" :key="i">
      <div v-if="item.header" class="kv-header">{{ item.key }}</div>
      <div
        v-else
        class="kv-row"
        :class="{ 'kv-row--copied': copiedIndex === i }"
        :title="copyTitle(item)"
        @click="copyRow(item, i)"
      >
        <span class="kv-key" :style="{ paddingLeft: (item.indent ?? 0) * 14 + 'px' }">{{ item.key }}</span>
        <span
          v-if="item.pill"
          class="kv-pill"
          :class="'kv-pill--' + (item.tone ?? item.value)"
        >{{ copiedIndex === i ? 'Copied' : item.value ?? '—' }}</span>
        <span
          v-else
          class="kv-value"
          :class="{ 'kv-value--copied': copiedIndex === i }"
          :title="item.title ?? ''"
        >{{ copiedIndex === i ? 'Copied' : item.value ?? '—' }}</span>
      </div>
    </template>
  </div>
</template>
