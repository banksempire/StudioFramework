<script setup lang="ts">
import type { PanelHeaderAction, PanelHeaderData } from '../types/panel';
import Icon from './Icon.vue';

defineProps<{
  data: PanelHeaderData;
  variant?: 'plain' | 'bar';
  action?: PanelHeaderAction;
}>();

const emit = defineEmits<{ 'action-click': [] }>();
</script>

<template>
  <div class="sf-ph" :class="'sf-ph--' + (variant ?? 'bar')">
    <span v-if="data.dot" class="sf-ph-dot" :class="'sf-ph-dot--' + data.dot" />
    <span v-if="data.title" class="sf-ph-title" :title="data.tip">{{ data.title }}</span>
    <button
      v-if="action && (action.label || action.icon)"
      class="sf-ph-act"
      :class="'sf-ph-act--' + (action.variant ?? 'default')"
      type="button"
:disabled="data.disabled"
      :title="action.title"
      @click="emit('action-click')"
    >
      <Icon v-if="action.icon" :icon="action.icon" />
      <span v-if="action.label">{{ action.label }}</span>
    </button>
  </div>
</template>
