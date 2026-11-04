<script setup lang="ts">
import { computed, provide } from 'vue';
import { kHostedTab } from '../composables/useHostedTab';
import { kIsMobile } from '../composables/useWorkspace';

const props = defineProps<{ tabId: string; parked: boolean; mobile: boolean; view?: Window | null }>();

const visible = computed(() => !props.parked);
const mobile = computed(() => props.mobile);
const view = computed(() => props.view ?? window);

provide(kHostedTab, {
  tabId: props.tabId,
  visible,
  view,
});
provide(kIsMobile, mobile);
</script>

<template>
  <slot />
</template>
