<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <div class="sf-tile-placeholder">
    <div class="sf-tile-lines">
      <div v-for="n in 12" :key="n" class="sf-tile-line">
        <span class="sf-line-number">{{ n }}</span>
        <span class="sf-line-text">{{ n === 1 ? '// ' + label : '' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sf-tile-placeholder {
  flex: 1;
  min-height: 0;
}
</style>
