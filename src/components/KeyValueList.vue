<script setup lang="ts">
import { ref } from 'vue';
import { copyTextToClipboard } from '../lib/clipboard';
import type { KeyValueItem } from '../types/panel';

const props = defineProps<{
  items: KeyValueItem[];
  empty?: string;
}>();

const copiedIndex = ref<number | null>(null);
const rootEl = ref<HTMLElement | null>(null);
let copyTimer: number | undefined;

function copyRow(item: KeyValueItem, index: number) {
  const text = `${item.key}: ${item.title ?? item.value ?? ''}`;
  const done = () => {
    copiedIndex.value = index;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      copiedIndex.value = null;
    }, 1200);
  };
  copyTextToClipboard(text, rootEl.value)
    .then(done)
    .catch(() => {});
}

function copyTitle(item: KeyValueItem): string {
  return `Click to copy: ${item.key}: ${item.title ?? item.value ?? ''}`;
}
</script>

<template>
  <div v-if="props.items.length === 0 && props.empty" class="sf-empty">{{ props.empty }}</div>
  <div v-else ref="rootEl" class="kv-list">
    <template v-for="(item, i) in props.items" :key="i">
      <div v-if="item.header" class="kv-header" :data-key="item.key">{{ item.key }}</div>
      <div
        v-else
        class="kv-row"
        :class="{ 'kv-row--copied': copiedIndex === i }"
        :data-key="item.key"
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
