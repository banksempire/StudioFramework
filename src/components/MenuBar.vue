<script setup lang="ts">
import { ref } from 'vue';

defineEmits<{
  'toggle-right-panel': [];
  'toggle-left-panel': [];
}>();

interface MenuItem {
  label: string;
  separator?: boolean;
  action?: () => void;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

const menus: Menu[] = [
  {
    label: 'File',
    items: [
      { label: 'New File', action: () => console.log('New File') },
      { label: 'Open Folder...', action: () => console.log('Open Folder') },
      { label: '', separator: true },
      { label: 'Save', action: () => console.log('Save') },
      { label: 'Save As...', action: () => console.log('Save As') },
      { label: '', separator: true },
      { label: 'Exit', action: () => console.log('Exit') },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', action: () => console.log('Undo') },
      { label: 'Redo', action: () => console.log('Redo') },
      { label: '', separator: true },
      { label: 'Cut', action: () => console.log('Cut') },
      { label: 'Copy', action: () => console.log('Copy') },
      { label: 'Paste', action: () => console.log('Paste') },
    ],
  },
  {
    label: 'Selection',
    items: [
      { label: 'Select All', action: () => console.log('Select All') },
      { label: 'Expand Selection', action: () => console.log('Expand') },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Toggle Left Panel', action: () => console.log('Toggle Left Panel') },
      { label: 'Toggle Terminal', action: () => console.log('Terminal') },
      { label: '', separator: true },
      { label: 'Zoom In', action: () => console.log('Zoom In') },
      { label: 'Zoom Out', action: () => console.log('Zoom Out') },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'About', action: () => alert('Studio Framework v1.0 • Vue 3') },
      { label: 'Documentation', action: () => console.log('Docs') },
    ],
  },
];

const openMenu = ref<string | null>(null);

function onMenuClick(label: string) {
  openMenu.value = openMenu.value === label ? null : label;
}

function onMenuHover(label: string) {
  if (openMenu.value) openMenu.value = label;
}

function onItemClick(item: MenuItem) {
  openMenu.value = null;
  item.action?.();
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
        title="Toggle Left Panel"
        @click="$emit('toggle-left-panel')"
      >
        ☰
      </button>
    </div>

    <div class="sf-menu-items">
      <div
        v-for="menu in menus"
        :key="menu.label"
        class="sf-menu-item"
        @click="onMenuClick(menu.label)"
        @mouseenter="onMenuHover(menu.label)"
      >
        {{ menu.label }}
        <div v-if="openMenu === menu.label" class="sf-menu-dropdown open">
          <template v-for="(item, i) in menu.items" :key="i">
            <div v-if="item.separator" class="sf-menu-separator" />
            <div
              v-else
              class="sf-menu-dropdown-item"
              @click.stop="onItemClick(item)"
            >
              {{ item.label }}
            </div>
          </template>
        </div>
      </div>
    </div>

    <div class="sf-menu-actions">
      <button
        class="sf-menu-action-btn"
        title="Toggle Right Panel"
        @click="$emit('toggle-right-panel')"
      >
        ◫
      </button>
    </div>
  </div>
</template>