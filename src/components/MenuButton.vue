<script setup lang="ts">
import { ref } from 'vue';
import type { MenuNodeDef } from '../types/layout';
import Icon from './Icon.vue';
import Menu from './Menu.vue';

const props = defineProps<{
  label: string;
  icon?: MenuNodeDef['icon'];
  title?: string;
  items: MenuNodeDef[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ select: [item: MenuNodeDef] }>();

const open = ref(false);
</script>

<template>
  <Menu
    :items="props.items"
    :open="open"
    :title="props.title ?? props.label"
    @update:open="(v) => (open = v)"
    @select="(item) => emit('select', item)"
  >
    <template #trigger="{ toggle }">
      <button
        class="sf-pc-menubtn sf-panel-btn"
        type="button"
        :disabled="props.disabled"
        @click="toggle"
      >
        <Icon v-if="props.icon" :icon="props.icon" />
        <span>{{ props.label }}</span>
      </button>
    </template>
  </Menu>
</template>
