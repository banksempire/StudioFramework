<script setup lang="ts">
import { ref } from 'vue';
import type { KeyValueItem } from '../types/panel';

defineProps<{
  items: KeyValueItem[];
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
  const text = `${item.key}: ${item.value ?? ''}`;
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
</script>

<template>
  <div class="kv-list">
    <div
      v-for="(item, i) in items"
      :key="item.key"
      class="kv-row"
      :class="{ 'kv-row--copied': copiedIndex === i }"
      :title="'Click to copy: ' + item.key + ': ' + (item.value ?? '')"
      @click="copyRow(item, i)"
    >
      <span class="kv-key">{{ item.key }}</span>
      <span
        v-if="item.pill"
        class="kv-pill"
        :class="'kv-pill--' + (item.tone ?? item.value)"
      >{{ copiedIndex === i ? 'Copied' : item.value ?? '—' }}</span>
      <span v-else class="kv-value">{{ copiedIndex === i ? 'Copied' : item.value ?? '—' }}</span>
    </div>
  </div>
</template>
