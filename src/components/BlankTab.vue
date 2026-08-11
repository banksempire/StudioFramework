<script setup lang="ts">
/**
 * Built-in blank page for GHOST tabs — windows that were part of a
 * restored/saved workspace but no longer exist (e.g. a deleted chat
 * session). The tile keeps its slot; the content is a quiet empty page.
 * Rendered by key 'sf-blank' (see Tile.vue — no registry entry needed).
 */
</script>

<template>
  <div class="sf-blank-tab">
    <p class="sf-blank-tab-hint">Window unavailable</p>
  </div>
</template>

<style scoped>
.sf-blank-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sf-blank-tab-hint {
  color: var(--sf-text-muted);
  opacity: 0.55;
  font-size: 16px;
}
</style>
