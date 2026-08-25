<script setup lang="ts">
import { ref } from 'vue';
import { getUtilityMenu } from '../registry';
import type { PanelAction, PanelSubSection } from '../types/panel';
import Menu from './Menu.vue';
import PanelComponent from './PanelComponent.vue';
import SvgIcon from './SvgIcon.vue';

defineProps<{
  subSection: PanelSubSection;
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

function menuItemsOf(utilId: string) {
  return getUtilityMenu(utilId)?.();
}
</script>

<template>
  <div
    class="sf-subsection"
    :class="{ 'sf-subsection--collapsed': !isExpanded }"
  >
    <div class="sf-subsection-header" @click="emit('toggle-expand')">
      <span class="sf-subsection-arrow" :class="{ 'sf-subsection-arrow--expanded': isExpanded }"><SvgIcon name="❯" /></span>
      <span class="sf-subsection-label">{{ subSection.label }}</span>
      <div v-if="subSection.utilities?.length" class="sf-subsection-utils" @click.stop>
        <template v-for="util in subSection.utilities" :key="util.id">
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
          </button>
        </template>
      </div>
    </div>

    <div
      v-if="isExpanded"
      class="sf-subsection-body"
      :data-sub-body="subSection.id"
      :style="bodyHeight !== null ? { height: bodyHeight + 'px', overflowY: 'auto' } : {}"
    >
      <PanelComponent
        v-for="(comp, i) in subSection.components"
        :key="i"
        :component="comp"
        @content-changed="emit('content-changed')"
        @action="(a) => emit('component-action', a)"
      />
    </div>
  </div>
</template>
