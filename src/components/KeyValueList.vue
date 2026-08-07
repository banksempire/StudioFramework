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
 */
import type { KeyValueItem } from '../types/panel';

defineProps<{
  items: KeyValueItem[];
}>();
</script>

<template>
  <div class="kv-list">
    <div v-for="item in items" :key="item.key" class="kv-row">
      <span class="kv-key">{{ item.key }}</span>
      <span
        v-if="item.pill"
        class="kv-pill"
        :class="'kv-pill--' + (item.tone ?? item.value)"
      >{{ item.value ?? '—' }}</span>
      <span v-else class="kv-value">{{ item.value ?? '—' }}</span>
    </div>
  </div>
</template>
