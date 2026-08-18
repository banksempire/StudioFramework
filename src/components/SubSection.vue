<script setup lang="ts">
import type { PanelAction, PanelSubSection } from '../types/panel';
import PanelComponent from './PanelComponent.vue';
import SvgIcon from './SvgIcon.vue';

defineProps<{
  subSection: PanelSubSection;
  isExpanded: boolean;
  isActive: boolean;
  bodyHeight: number | null;
}>();

const emit = defineEmits<{
  'toggle-expand': [];
  activate: [];
  utility: [utilityId: string];
  'content-changed': [];
  'component-action': [action: PanelAction];
}>();
</script>

<template>
  <div
    class="sf-subsection"
    :class="{ 'sf-subsection--collapsed': !isExpanded, 'sf-subsection--active': isActive }"
  >
    <div class="sf-subsection-header" @click="emit('toggle-expand')">
      <span class="sf-subsection-arrow" :class="{ 'sf-subsection-arrow--expanded': isExpanded }"><SvgIcon name="❯" /></span>
      <span class="sf-subsection-label">{{ subSection.label }}</span>
      <div v-if="subSection.utilities?.length" class="sf-subsection-utils" @click.stop="emit('activate')">
        <button
          v-for="util in subSection.utilities"
          :key="util.id"
          class="sf-subsection-util"
          :title="util.tooltip"
          @click="emit('utility', util.id)"
        >
          <SvgIcon v-if="typeof util.icon === 'string'" :name="util.icon" />
          <img v-else :src="util.icon.url" alt="" />
        </button>
      </div>
    </div>

    <div
      v-if="isExpanded"
      class="sf-subsection-body"
      :data-sub-body="subSection.id"
      :style="bodyHeight !== null ? { height: bodyHeight + 'px', overflowY: 'auto' } : {}"
      @click="emit('activate')"
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
