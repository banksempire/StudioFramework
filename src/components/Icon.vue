<script setup lang="ts">
import type { IconDef } from '../types/panel';

defineProps<{
  /** string = unicode char, object = image */
  icon?: IconDef;
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <img
    v-if="typeof icon === 'object'"
    class="sf-icon sf-icon--img"
    :src="icon.url"
    alt=""
  />
  <span v-else-if="icon" class="sf-icon" @click="emit('click')">{{ icon }}</span>
</template>
