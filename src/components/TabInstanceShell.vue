<script setup lang="ts">
import { computed, provide } from 'vue';
import { kHostedTab } from '../composables/useHostedTab';
import { kIsMobile } from '../composables/useWorkspace';

const props = defineProps<{ tabId: string; parked: boolean; mobile: boolean }>();

const visible = computed(() => !props.parked);
const mobile = computed(() => props.mobile);

provide(kHostedTab, {
  tabId: props.tabId,
  visible,
});
provide(kIsMobile, mobile);
</script>

<template>
  <slot />
</template>
