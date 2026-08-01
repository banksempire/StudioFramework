<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import type { MenuDef, MenuItemDef } from '../types/layout';

const props = defineProps<{
  menus: MenuDef[];
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
}>();

const emit = defineEmits<{
  'toggle-right-panel': [];
  'toggle-left-panel': [];
  'menu-action': [actionId: string];
}>();

const openMenu = ref<string | null>(null);

function onMenuClick(label: string) {
  openMenu.value = openMenu.value === label ? null : label;
}

function onMenuHover(label: string) {
  if (openMenu.value) openMenu.value = label;
}

function onItemClick(item: MenuItemDef) {
  openMenu.value = null;
  if (item.action) emit('menu-action', item.action);
}

function closeAll() {
  openMenu.value = null;
}
</script>

<template>
  <div class="sf-menu-bar" @mouseleave="closeAll">
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
          <template v-for="(item, i) in menu.items" :key="item.id ?? i">
            <div v-if="item.separator" class="sf-menu-separator" />
            <div
              v-else
              class="sf-menu-dropdown-item"
              @click.stop="onItemClick(item)"
            >
              <Icon v-if="item.icon" :icon="item.icon" />
              <span class="sf-menu-dropdown-label">{{ item.label }}</span>
              <span v-if="item.accelerator" class="sf-menu-dropdown-acc">{{ item.accelerator }}</span>
            </div>
          </template>
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
