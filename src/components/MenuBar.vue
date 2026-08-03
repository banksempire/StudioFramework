<script setup lang="ts">
import { ref } from 'vue';
import MenuDropdown from './MenuDropdown.vue';
import { useClickOutside } from '../composables/useClickOutside';
import type { MenuNodeDef } from '../types/layout';

const props = defineProps<{
  menus: MenuNodeDef[];
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
}>();

const emit = defineEmits<{
  'toggle-right-panel': [];
  'toggle-left-panel': [];
  'menu-action': [actionId: string];
}>();

const openMenu = ref<string | null>(null);
useClickOutside(openMenu, '.sf-menu-bar');

function onMenuClick(label?: string) {
  if (!label) return;
  openMenu.value = openMenu.value === label ? null : label;
}

function onMenuHover(label?: string) {
  if (!label || !openMenu.value) return;
  openMenu.value = label;
}

function onItemAction(actionId: string) {
  openMenu.value = null;
  emit('menu-action', actionId);
}
</script>

<template>
  <div class="sf-menu-bar">
    <div class="sf-menu-actions sf-menu-actions--left">
      <button
        class="sf-menu-action-btn"
        :title="props.leftPanelVisible ? 'Collapse Left Panel' : 'Expand Left Panel'"
        @click="emit('toggle-left-panel')"
      >
        {{ props.leftPanelVisible ? '\u25E8' : '\u25EB' }}
      </button>
    </div>

    <div class="sf-menu-items">
      <div
        v-for="menu in menus"
        :key="menu.id"
        class="sf-menu-item"
        @click="onMenuClick(menu.label)"
        @mouseenter="onMenuHover(menu.label)"
      >
        {{ menu.label }}
        <div v-if="openMenu === menu.label" class="sf-menu-dropdown open">
          <MenuDropdown
            :items="menu.items ?? []"
            @action="onItemAction"
          />
        </div>
      </div>
    </div>

    <div class="sf-menu-actions">
      <button
        class="sf-menu-action-btn"
        :title="props.rightPanelVisible ? 'Collapse Right Panel' : 'Expand Right Panel'"
        @click="emit('toggle-right-panel')"
      >
        {{ props.rightPanelVisible ? '\u25E7' : '\u25EB' }}
      </button>
    </div>
  </div>
</template>
