<script setup lang="ts">
import { computed, ref } from 'vue';
import type { MenuNodeDef } from '../types/layout';
import Icon from './Icon.vue';
import Menu from './Menu.vue';

const props = defineProps<{
  label: string;
  icon?: MenuNodeDef['icon'];
  title?: string;
  variant?: string;
  items: MenuNodeDef[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ press: []; select: [item: MenuNodeDef] }>();

const open = ref(false);

const variantClass = computed(() =>
  props.variant && props.variant !== 'default' ? `sf-dialog-btn--${props.variant}` : undefined,
);
</script>

<template>
  <Menu
    v-if="props.items.length > 0"
    :items="props.items"
    :open="open"
    :title="props.title ?? props.label"
    @update:open="(v) => (open = v)"
    @select="(item) => emit('select', item)"
  >
    <template #trigger="{ toggle }">
      <button
        class="sf-dialog-btn sf-panel-btn"
        :class="variantClass"
        type="button"
        :disabled="props.disabled"
        :title="props.title"
        @click="toggle"
      >
        <Icon v-if="props.icon" :icon="props.icon" />
        <span>{{ props.label }}</span>
      </button>
    </template>
  </Menu>
  <button
    v-else
    class="sf-dialog-btn sf-panel-btn"
    :class="variantClass"
    type="button"
    :disabled="props.disabled"
    :title="props.title"
    @click="emit('press')"
  >
    <Icon v-if="props.icon" :icon="props.icon" />
    <span>{{ props.label }}</span>
  </button>
</template>
