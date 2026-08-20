<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { IconDef } from '../types/panel';
import Icon from './Icon.vue';
import SvgIcon from './SvgIcon.vue';

export interface TabDropdownItem {
  id: string;
  label: string;
  icon?: IconDef;
  closeable?: boolean;
}

const props = withDefaults(
  defineProps<{
    open?: boolean;
    items: TabDropdownItem[];
    activeId?: string | null;
  }>(),
  { open: false, activeId: null },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [id: string];
  close: [id: string];
}>();

const menuTab = ref<TabDropdownItem | null>(null);

function onRowClick(id: string) {
  emit('select', id);
  emit('update:open', false);
}

function doClose() {
  const tab = menuTab.value;
  if (!tab) return;
  menuTab.value = null;
  emit('close', tab.id);
}

function closeSheet() {
  emit('update:open', false);
}

watch(
  () => props.open,
  (o) => {
    if (!o) menuTab.value = null;
  },
);

const sheetTarget = ref<HTMLElement | 'body'>('body');
onMounted(() => {
  sheetTarget.value = (document.querySelector('.sf-root') as HTMLElement | null) ?? 'body';
});
</script>

<template>
  <Teleport :to="sheetTarget">
    <div v-if="open" class="sf-tab-dropdown">
      <div class="sf-tab-dropdown-bar">
        <span class="sf-tab-dropdown-title">tabs</span>
        <button class="sf-tab-dropdown-close" title="Close" @click="closeSheet">
          <SvgIcon name="✕" />
        </button>
      </div>
      <div class="sf-tab-dropdown-body">
        <div class="sf-tab-dropdown-list">
          <div
            v-for="tab in items"
            :key="tab.id"
            class="sf-tab-dropdown-row"
            @click="onRowClick(tab.id)"
          >
            <span v-if="tab.id === activeId" class="sf-tab-dropdown-mark" />
            <span class="sf-tab-dropdown-icon">
              <Icon v-if="tab.icon" :icon="tab.icon" />
            </span>
            <span class="sf-tab-dropdown-label">{{ tab.label }}</span>
            <button
              v-if="tab.closeable !== false"
              class="sf-tab-dropdown-more"
              title="More"
              aria-label="More actions"
              @click.stop="menuTab = tab"
            >
              <SvgIcon name="⋮" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="menuTab" class="sf-sm-dialog-backdrop" @click.self="menuTab = null">
      <div class="sf-sm-dialog" role="dialog">
        <div class="sf-sm-dialog-title">{{ menuTab.label }}</div>
        <button class="sf-sm-menu-row sf-sm-dialog-row" @click="doClose">
          <SvgIcon name="✕" />
          <span>Close</span>
        </button>
        <button class="sf-sm-dialog-cancel" @click="menuTab = null">Cancel</button>
      </div>
    </div>
  </Teleport>
</template>
