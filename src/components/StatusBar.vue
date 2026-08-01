<script setup lang="ts">
import type { StatusItemDef } from '../types/layout';

defineProps<{
  left: StatusItemDef[];
  right: StatusItemDef[];
}>();
</script>

<template>
  <div class="sf-status-bar">
    <div class="sf-status-left">
      <span v-for="item in left" :key="item.id ?? item.label" class="sf-status-item">
        {{ item.label }}
      </span>
    </div>
    <div class="sf-status-right">
      <span v-for="item in right" :key="item.id ?? item.label" class="sf-status-item">
        {{ item.label }}
      </span>
    </div>
  </div>
</template>
