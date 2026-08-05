<script setup lang="ts">
import Icon from './Icon.vue';
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
        <Icon v-if="item.icon" :icon="item.icon" class="sf-status-item-icon" />
        {{ item.label }}
      </span>
    </div>
    <div class="sf-status-right">
      <span v-for="item in right" :key="item.id ?? item.label" class="sf-status-item">
        <Icon v-if="item.icon" :icon="item.icon" class="sf-status-item-icon" />
        {{ item.label }}
      </span>
    </div>
  </div>
</template>
