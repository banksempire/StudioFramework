<script setup lang="ts">
import type { PanelSubSection } from '../types/panel';
import PanelComponent from './PanelComponent.vue';

defineProps<{
  subSection: PanelSubSection;
  isExpanded: boolean;
  /** null = auto-height (fixed sub-section), number = explicit px (variable) */
  bodyHeight: number | null;
}>();

const emit = defineEmits<{
  'toggle-expand': [];
  utility: [utilityId: string];
  'content-changed': [];
}>();
</script>

<template>
  <div class="sf-subsection" :class="{ 'sf-subsection--collapsed': !isExpanded }">
    <!-- Title bar -->
    <div class="sf-subsection-header" @click="emit('toggle-expand')">
      <span class="sf-subsection-arrow" :class="{ 'sf-subsection-arrow--expanded': isExpanded }">❯</span>
      <span class="sf-subsection-label">{{ subSection.label }}{{ !subSection.isHeightVariable ? ' [F]' : '' }}</span>
      <div v-if="subSection.utilities?.length" class="sf-subsection-utils" @click.stop>
        <button
          v-for="util in subSection.utilities"
          :key="util.id"
          class="sf-subsection-util"
          :title="util.tooltip"
          @click="emit('utility', util.id)"
        >{{ util.icon }}</button>
      </div>
    </div>

    <!-- Component body -->
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
      />
    </div>
  </div>
</template>
