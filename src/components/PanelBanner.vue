<script setup lang="ts">
defineProps<{
  text?: string;
  tone?: 'info' | 'error';
}>();
</script>

<template>
  <div v-if="text" class="sf-banner" :class="'sf-banner--' + (tone ?? 'info')">{{ text }}</div>
</template>
