<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import type { MenuNodeDef } from '../types/layout';

defineProps<{
  items: MenuNodeDef[];
}>();

const emit = defineEmits<{
  action: [actionId: string];
}>();

// Which submenu (by item index) is currently open in THIS level
const openIndex = ref<number | null>(null);

function onItemClick(item: MenuNodeDef) {
  if (item.items?.length) return; // submenu parent: only opens on hover
  if (item.action) emit('action', item.action);
}
</script>

<template>
  <template v-for="(item, i) in items" :key="item.id ?? i">
    <div v-if="item.separator" class="sf-menu-separator" />

    <div
      v-else
      class="sf-menu-dropdown-item"
      @mouseenter="openIndex = item.items?.length ? i : null"
      @click.stop="onItemClick(item)"
    >
      <Icon v-if="item.icon" :icon="item.icon" />
      <span class="sf-menu-dropdown-label">{{ item.label }}</span>
      <span v-if="item.accelerator" class="sf-menu-dropdown-acc">{{ item.accelerator }}</span>
      <span v-if="item.items?.length" class="sf-menu-dropdown-caret">▶</span>

      <!-- Nested level (recursive) - wrapped in a real div: fragment
           components cannot receive class fallthrough, and the submenu
           needs its own positioned container -->
      <div
        v-if="openIndex === i && item.items?.length"
        class="sf-menu-submenu"
      >
        <MenuDropdown
          :items="item.items"
          @action="emit('action', $event)"
        />
      </div>
    </div>
  </template>
</template>
