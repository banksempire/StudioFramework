<script setup lang="ts">
import Panel from './Panel.vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'collapse': [];
}>();
</script>

<template>
  <Panel
    title="Properties"
    :visible="visible"
    position="right"
    @collapse="emit('collapse')"
  />
</template>
