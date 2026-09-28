<script setup lang="ts">
import { computed, ref } from 'vue';
import { getPanelData, getUtilityMenu } from '../registry';
import type { PanelAction, PanelBulkAction, PanelH2 } from '../types/panel';
import Icon from './Icon.vue';
import Menu from './Menu.vue';
import PanelComponent from './PanelComponent.vue';
import SvgIcon from './SvgIcon.vue';

const props = defineProps<{
  section: PanelH2;
  isExpanded: boolean;
  bodyHeight: number | null;
}>();

const emit = defineEmits<{
  'toggle-expand': [];
  utility: [utilityId: string, itemId?: string];
  'content-changed': [];
  'component-action': [action: PanelAction];
}>();

const openMenuId = ref<string | null>(null);

const bulkEntry = computed<{ bind: string; entry: PanelBulkAction } | null>(() => {
  const list = props.section.components.find((c) => c.type === 'list') as { bind?: string } | undefined;
  if (!list?.bind) return null;
  const getter = getPanelData(list.bind);
  const rec = getter
    ? (getter() as { bulk?: { active?: boolean; entry?: PanelBulkAction } } | undefined)
    : undefined;
  if (!rec?.bulk || rec.bulk.active || !rec.bulk.entry) return null;
  return { bind: list.bind, entry: rec.bulk.entry };
});

function emitBulkEntry() {
  if (!bulkEntry.value) return;
  emit('component-action', {
    source: 'list',
    action: 'bulk',
    payload: { gesture: 'entry', bind: bulkEntry.value.bind },
  });
}

const displayTitle = computed(() => {
  const list = props.section.components.find((c) => c.type === 'list') as { bind?: string } | undefined;
  if (!list?.bind) return props.section.title;
  const getter = getPanelData(list.bind);
  const rec = getter ? (getter() as { title?: string } | undefined) : undefined;
  return rec?.title || props.section.title;
});

function menuItemsOf(utilId: string) {
  return getUtilityMenu(utilId)?.();
}
</script>

<template>
  <div
    class="sf-subsection"
    :class="{ 'sf-subsection--collapsed': !isExpanded, 'sf-subsection--h3': section.heading === 3 }"
  >
    <div
      v-if="section.heading === 3"
      class="sf-subsection-header sf-subsection-header--h3"
    >
      <span class="sf-subsection-label sf-subsection-label--h3">{{ displayTitle }}</span>
      <div v-if="section.utilities?.length" class="sf-subsection-utils">
        <template v-for="util in section.utilities" :key="util.id">
          <Menu
            v-if="menuItemsOf(util.id)"
            :items="menuItemsOf(util.id) ?? []"
            :open="openMenuId === util.id"
            :title="util.tooltip"
            :close-on-select="false"
            @update:open="(v) => (openMenuId = v ? util.id : null)"
            @select="(item) => item.id && emit('utility', util.id, item.id)"
          >
            <template #trigger="{ toggle }">
              <button class="sf-subsection-util" :title="util.tooltip" @click.stop="toggle">
                <SvgIcon v-if="typeof util.icon === 'string'" :name="util.icon" />
                <img v-else :src="util.icon.url" alt="" />
                <span v-if="util.label" class="sf-subsection-util-label">{{ util.label }}</span>
              </button>
            </template>
          </Menu>
          <button
            v-else
            class="sf-subsection-util"
            :title="util.tooltip"
            @click="emit('utility', util.id)"
          >
            <SvgIcon v-if="typeof util.icon === 'string'" :name="util.icon" />
            <img v-else :src="util.icon.url" alt="" />
            <span v-if="util.label" class="sf-subsection-util-label">{{ util.label }}</span>
          </button>
        </template>
      </div>
    </div>
    <div v-else class="sf-subsection-header" @click="emit('toggle-expand')">
      <span class="sf-subsection-arrow" :class="{ 'sf-subsection-arrow--expanded': isExpanded }"><SvgIcon name="❯" /></span>
      <span class="sf-subsection-label">{{ displayTitle }}</span>
      <div v-if="section.utilities?.length || bulkEntry" class="sf-subsection-utils" @click.stop>
        <button
          v-if="bulkEntry"
          class="sf-subsection-bulk-entry"
          type="button"
          @click="emitBulkEntry"
        >
          <Icon
            v-if="bulkEntry.entry.icon && typeof bulkEntry.entry.icon === 'string'"
            :icon="bulkEntry.entry.icon"
          />
          <img
            v-else-if="bulkEntry.entry.icon && typeof bulkEntry.entry.icon !== 'string'"
            :src="bulkEntry.entry.icon.url"
            alt=""
          />
          {{ bulkEntry.entry.label }}
        </button>
        <template v-for="util in section.utilities" :key="util.id">
          <Menu
            v-if="menuItemsOf(util.id)"
            :items="menuItemsOf(util.id) ?? []"
            :open="openMenuId === util.id"
            :title="util.tooltip"
            :close-on-select="false"
            @update:open="(v) => (openMenuId = v ? util.id : null)"
            @select="(item) => item.id && emit('utility', util.id, item.id)"
          >
            <template #trigger="{ toggle }">
              <button class="sf-subsection-util" :title="util.tooltip" @click.stop="toggle">
                <SvgIcon v-if="typeof util.icon === 'string'" :name="util.icon" />
                <img v-else :src="util.icon.url" alt="" />
                <span v-if="util.label" class="sf-subsection-util-label">{{ util.label }}</span>
              </button>
            </template>
          </Menu>
          <button
            v-else
            class="sf-subsection-util"
            :title="util.tooltip"
            @click="emit('utility', util.id)"
          >
            <SvgIcon v-if="typeof util.icon === 'string'" :name="util.icon" />
            <img v-else :src="util.icon.url" alt="" />
            <span v-if="util.label" class="sf-subsection-util-label">{{ util.label }}</span>
          </button>
        </template>
      </div>
    </div>

    <div
      v-if="section.heading === 3 || isExpanded"
      class="sf-subsection-body"
      :data-sub-body="section.id"
      :style="bodyHeight !== null ? { height: bodyHeight + 'px', overflowY: 'auto' } : {}"
    >
      <PanelComponent
        v-for="(comp, i) in section.components"
        :key="i"
        :component="comp"
        @content-changed="emit('content-changed')"
        @action="(a) => emit('component-action', a)"
      />
    </div>
    <slot name="trailing" />
  </div>
</template>
