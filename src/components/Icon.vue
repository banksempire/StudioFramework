<script setup lang="ts">
import type { IconDef } from '../types/panel';
import SvgIcon from './SvgIcon.vue';

defineProps<{
  icon?: IconDef;
}>();
</script>

<template>
  <img
    v-if="typeof icon === 'object'"
    class="sf-icon sf-icon--img"
    :src="icon.url"
    alt=""
  />
  <SvgIcon v-else-if="icon" :name="icon" />
</template>
