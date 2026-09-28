<script setup lang="ts">
import SvgIcon from './SvgIcon.vue';

const page = defineModel<number>('page', { required: true });
defineProps<{ pageCount: number }>();
</script>

<template>
  <div class="sf-pagenav">
    <button class="sf-pagenav-btn" type="button" title="First page" :disabled="page <= 1" @click="page = 1">
      <SvgIcon name="«" />
    </button>
    <button class="sf-pagenav-btn" type="button" title="Previous page" :disabled="page <= 1" @click="page -= 1">
      <SvgIcon name="‹" />
    </button>
    <select
      v-model.number="page"
      class="sf-pagenav-page"
      title="Select page"
      :aria-label="`Page select, ${pageCount} pages`"
    >
      <option v-for="p in pageCount" :key="p" :value="p">{{ p }} / {{ pageCount }}</option>
    </select>
    <button
      class="sf-pagenav-btn"
      type="button"
      title="Next page"
      :disabled="page >= pageCount"
      @click="page += 1"
    >
      <SvgIcon name="›" />
    </button>
    <button
      class="sf-pagenav-btn"
      type="button"
      title="Last page"
      :disabled="page >= pageCount"
      @click="page = pageCount"
    >
      <SvgIcon name="»" />
    </button>
  </div>
</template>

<style scoped>
.sf-pagenav {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: var(--sf-radius-sm);
  overflow: hidden;
  background: var(--sf-bar);
}
.sf-pagenav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  flex-shrink: 0;
  background: none;
  border: none;
  border-radius: 0;
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 16px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}
.sf-pagenav-btn:not(:first-child) {
  border-left: 1px solid var(--sf-border);
}
.sf-pagenav-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (hover: hover) {
  .sf-pagenav-btn:not(:disabled):hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
  }
}
.sf-pagenav-page {
  appearance: none;
  -webkit-appearance: none;
  width: auto;
  height: 24px;
  box-sizing: border-box;
  border: none;
  border-left: 1px solid var(--sf-border);
  border-radius: 0;
  background: none;
  background-image: none;
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 12px;
  padding: 0 8px;
  cursor: pointer;
  text-align: center;
  text-align-last: center;
}
.sf-root--mobile .sf-pagenav {
  border-radius: 8px;
}
.sf-root--mobile .sf-pagenav-btn {
  width: 56px;
  height: 44px;
  font-size: 20px;
}
.sf-root--mobile .sf-pagenav-page {
  height: 44px;
  font-size: 16px;
}
</style>
