<script setup lang="ts">
import { type Component, computed, inject, ref } from 'vue';
import { BLANK_CONTENT, kIsMobile, useWorkspaceContext } from '../composables/useWorkspace';
import { getTabContent } from '../registry';
import { collectAllTabs } from '../workspace/tree';
import TabInstanceShell from './TabInstanceShell.vue';

const ws = useWorkspaceContext();
const mainMobile = inject(kIsMobile, ref(false));

const storage = document.createElement('div');
storage.className = 'sf-tab-storage';

function hostable(id: string): Component | null {
  const def = ws.tabDefs[id];
  if (!def?.content || def.content === BLANK_CONTENT) return null;
  return getTabContent(def.content) ?? null;
}

const hosted = computed(() => {
  const ids: string[] = [];
  for (const root of ws.roots) ids.push(...collectAllTabs(root.node));
  ids.push(...ws.detachedTabs.keys());
  return ids.filter((id) => hostable(id) !== null);
});

function compFor(id: string): Component {
  return hostable(id) as Component;
}

function targetFor(id: string): HTMLElement {
  return ws.tabSlots.get(id)?.el ?? storage;
}

function hostMobile(id: string): boolean {
  const slot = ws.tabSlots.get(id);
  if (slot?.tileId.startsWith('aux:')) {
    return ws.auxMobile.get(Number(slot.tileId.slice(4))) ?? false;
  }
  return mainMobile.value;
}
</script>

<template>
  <div class="sf-tab-hosts" aria-hidden="true">
    <Teleport v-for="id in hosted" :key="id" :to="targetFor(id)">
      <TabInstanceShell :tab-id="id" :parked="!ws.tabSlots.get(id)" :mobile="hostMobile(id)">
        <component :is="compFor(id)" class="sf-tile-custom" v-bind="ws.tabDefs[id]?.props ?? {}" />
      </TabInstanceShell>
    </Teleport>
  </div>
</template>
