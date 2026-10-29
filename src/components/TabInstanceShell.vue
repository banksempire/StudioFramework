<script setup lang="ts">
import { computed, provide } from 'vue';
import { kHostedTab } from '../composables/useHostedTab';

const props = defineProps<{ tabId: string; parked: boolean }>();

const visible = computed(() => !props.parked);

provide(kHostedTab, {
  tabId: props.tabId,
  visible,
});
</script>

<template>
  <slot />
</template>
