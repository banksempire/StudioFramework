<script setup lang="ts">
import Icon from './Icon.vue';
import { getStatusComponent } from '../registry';
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
        <template v-if="item.component && getStatusComponent(item.component)">
          <component :is="getStatusComponent(item.component)" v-bind="item.props ?? {}" />
        </template>
        <template v-else>
          <Icon v-if="item.icon" :icon="item.icon" class="sf-status-item-icon" />
          {{ item.label }}
        </template>
      </span>
    </div>
    <div class="sf-status-right">
      <span v-for="item in right" :key="item.id ?? item.label" class="sf-status-item">
        <template v-if="item.component && getStatusComponent(item.component)">
          <component :is="getStatusComponent(item.component)" v-bind="item.props ?? {}" />
        </template>
        <template v-else>
          <Icon v-if="item.icon" :icon="item.icon" class="sf-status-item-icon" />
          {{ item.label }}
        </template>
      </span>
    </div>
  </div>
</template>
