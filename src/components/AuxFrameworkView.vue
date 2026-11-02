<script setup lang="ts">
import { createApp, inject, onMounted, onUnmounted, ref } from 'vue';
import { kLayout, useWorkspaceContext } from '../composables/useWorkspace';
import type { FrameworkAction } from '../Framework.vue';
import Framework from '../Framework.vue';

const props = defineProps<{ windowId: number }>();
const ws = useWorkspaceContext();
const auxApi = ws.auxApi(props.windowId);
const layout = inject(kLayout);
const host = ref<HTMLElement | null>(null);
let app: ReturnType<typeof createApp> | null = null;

onMounted(() => {
  const el = ws.auxWindowContentEl(props.windowId);
  const viewport = el?.ownerDocument.defaultView;
  if (!el || !viewport) return;
  try {
    app = createApp(Framework, {
      layout: layout,
      api: auxApi,
      viewportWindow: viewport,
      statusBar: false,
      hostTabs: false,
      persistUiState: false,
      onAction: (action: FrameworkAction) => auxApi.emitAppAction(action),
    });
    app.mount(el);
  } catch (e) {}
});

onUnmounted(() => app?.unmount());
</script>

<template>
  <span ref="host" hidden />
</template>
