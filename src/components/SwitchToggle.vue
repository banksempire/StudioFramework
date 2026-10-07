<script setup lang="ts">
defineProps<{
  id?: string;
  on: boolean;
  title?: string;
}>();

const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    :id="id"
    class="sf-switch"
    :class="{ 'sf-switch--on': on }"
    type="button"
    role="switch"
    :aria-checked="on"
    :title="title"
    @click.stop="emit('toggle')"
  ><span class="sf-switch-knob" /></button>
</template>
