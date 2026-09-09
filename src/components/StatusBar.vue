<script setup lang="ts">
import { computed } from 'vue';
import { getPanelData, getStatusComponent } from '../registry';
import type { StatusItemDef } from '../types/layout';
import Icon from './Icon.vue';

const props = defineProps<{
  left: StatusItemDef[];
  right: StatusItemDef[];
}>();

function boundLabel(item: StatusItemDef): string {
  if (!item.bind) return item.label;
  const v = getPanelData(item.bind)?.();
  return typeof v === 'string' ? v : item.label;
}

function hasComponent(item: StatusItemDef): boolean {
  return !!item.component && !!getStatusComponent(item.component);
}

const items = computed(() => ({ left: props.left, right: props.right }));
</script>

<template>
  <div class="sf-status-bar">
    <div class="sf-status-left">
      <span v-for="item in items.left" :key="item.id ?? item.label" class="sf-status-item">
        <template v-if="hasComponent(item)">
          <component :is="getStatusComponent(item.component!)" v-bind="item.props ?? {}" />
        </template>
        <template v-else>
          <Icon v-if="item.icon" :icon="item.icon" class="sf-status-item-icon" />
          {{ boundLabel(item) }}
        </template>
      </span>
    </div>
    <div class="sf-status-right">
      <span v-for="item in items.right" :key="item.id ?? item.label" class="sf-status-item">
        <template v-if="hasComponent(item)">
          <component :is="getStatusComponent(item.component!)" v-bind="item.props ?? {}" />
        </template>
        <template v-else>
          <Icon v-if="item.icon" :icon="item.icon" class="sf-status-item-icon" />
          {{ boundLabel(item) }}
        </template>
      </span>
    </div>
  </div>
</template>
