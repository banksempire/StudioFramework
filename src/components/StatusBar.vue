<script setup lang="ts">
interface StatusItem {
  text: string;
  align?: 'left' | 'right';
}

const leftItems: StatusItem[] = [
  { text: 'Ln 1, Col 1' },
  { text: 'Spaces: 2' },
  { text: 'UTF-8' },
];

const rightItems: StatusItem[] = [
  { text: 'TypeScript' },
  { text: '🟢 main' },
  { text: 'Errors: 0 ⚠ 0' },
];
</script>

<template>
  <div class="sf-status-bar">
    <div class="sf-status-left">
      <span v-for="(item, i) in leftItems" :key="i" class="sf-status-item">
        {{ item.text }}
      </span>
    </div>
    <div class="sf-status-right">
      <span v-for="(item, i) in rightItems" :key="i" class="sf-status-item">
        {{ item.text }}
      </span>
    </div>
  </div>
</template>