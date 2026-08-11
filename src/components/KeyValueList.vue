<script setup lang="ts">
/**
 * KeyValueList — the framework's generic key-value rows (a label on the
 * left, a right-aligned value on the right). Every panel that shows
 * "fields" (session stats, model info, inspector data, …) renders through
 * this component — including the layout-declared `keyValueList` component
 * type (PanelComponent) — so all of them share one layout.
 *
 * A row can render its value as a pill (badge) instead of plain text:
 * `pill: true` + `tone` (defaults to the value) → class kv-pill--<tone>.
 * Base pill styles and a few generic tones (accent/muted/ok/warn/err) live
 * in the framework; apps add their own tones in their stylesheet.
 *
 * Clicking a row copies "key: value" to the clipboard with a transient
 * inline "Copied" feedback. The Clipboard API only exists in secure
 * contexts (https/localhost), so on http://<hostname> the copy falls back
 * to a hidden-textarea execCommand.
 */
import { ref } from 'vue';
import type { KeyValueItem } from '../types/panel';

defineProps<{
  items: KeyValueItem[];
}>();

/** Index of the row currently showing the "Copied" feedback. */
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
  } catch { /* clipboard unavailable */ }
}

function copyRow(item: KeyValueItem, index: number) {
  const text = `${item.key}: ${item.value ?? ''}`;
  const done = () => {
    copiedIndex.value = index;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => { copiedIndex.value = null; }, 1200);
  };
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => legacyCopy(text, done));
      return;
    }
  } catch { /* fall through to legacy */ }
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
