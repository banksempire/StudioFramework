<script setup lang="ts">
import { usePwaInstall } from '../pwa/install';

const { canInstall, promptInstall } = usePwaInstall();
</script>

<template>
  <button
    v-if="canInstall"
    type="button"
    class="sf-pwa-install"
    title="Install this app to your device"
    @click="promptInstall()"
  >
    <span class="sf-pwa-install-icon">⬇</span>
    <span class="sf-pwa-install-label">Install</span>
  </button>
</template>
