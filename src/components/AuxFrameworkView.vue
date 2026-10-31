<script setup lang="ts">
import { createApp, onMounted, onUnmounted, ref } from 'vue';
import { useWorkspaceContext } from '../composables/useWorkspace';
import Framework from '../Framework.vue';

const props = defineProps<{ windowId: number }>();
const ws = useWorkspaceContext();
const host = ref<HTMLElement | null>(null);
let app: ReturnType<typeof createApp> | null = null;

onMounted(() => {
  const el = ws.auxWindowContentEl(props.windowId);
  const viewport = el?.ownerDocument.defaultView;
  if (!el || !viewport) return;
  try {
    app = createApp(Framework, {
      api: ws.auxApi(props.windowId),
      viewportWindow: viewport,
      statusBar: false,
      hostTabs: false,
      persistUiState: false,
    });
    app.mount(el);
  } catch (e) {}
});

onUnmounted(() => app?.unmount());
</script>

<template>
  <span ref="host" hidden />
</template>
