<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import SvgIcon from './SvgIcon.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    open: boolean;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
  }>(),
  {
    closeOnBackdrop: true,
    closeOnEscape: true,
  },
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'close'): void;
}>();

const card = ref<HTMLElement | null>(null);
const teleportTarget = ref<string | HTMLElement>('body');

function resolveTeleportTarget() {
  if (typeof document === 'undefined') return;
  teleportTarget.value = (document.querySelector('.sf-root') as HTMLElement | null) ?? 'body';
}

function close() {
  if (!props.open) return;
  emit('update:open', false);
  emit('close');
}

function onBackdropDown(e: MouseEvent) {
  if (e.target === e.currentTarget && props.closeOnBackdrop) close();
}

function onDocKey(e: KeyboardEvent) {
  if (!props.open || !props.closeOnEscape) return;
  if (e.key === 'Escape') close();
}

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    resolveTeleportTarget();
    void nextTick(() => card.value?.focus());
  },
);

onMounted(() => {
  resolveTeleportTarget();
  window.addEventListener('keydown', onDocKey);
});
onUnmounted(() => window.removeEventListener('keydown', onDocKey));
</script>

<template>
  <Teleport :to="teleportTarget">
    <div v-if="props.open" class="sf-dialog-backdrop" @mousedown="onBackdropDown">
      <div
        ref="card"
        class="sf-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="props.title"
        tabindex="-1"
      >
        <header class="sf-dialog-head">
          <span class="sf-dialog-title">{{ props.title }}</span>
          <button type="button" class="sf-dialog-close" title="Close" @click="close">
            <SvgIcon name="✕" />
          </button>
        </header>
        <div class="sf-dialog-body">
          <slot />
        </div>
        <footer v-if="$slots.actions" class="sf-dialog-foot">
          <slot name="actions" :close="close" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sf-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: var(--sf-backdrop, rgba(0, 0, 0, 0.45));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.sf-dialog {
  width: min(440px, 100%);
  max-height: calc(100vh - 24px);
  display: flex;
  flex-direction: column;
  background: var(--sf-bg-lighter);
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius);
  box-shadow: var(--sf-shadow);
  outline: none;
}

.sf-dialog-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--sf-border);
}

.sf-dialog-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--sf-text-bright);
}

.sf-dialog-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--sf-danger);
  border-radius: var(--sf-radius-sm);
  background: var(--sf-danger);
  color: var(--sf-text-on-accent);
  font-family: var(--sf-font);
  font-size: 13px;
  cursor: pointer;
}

@media (hover: hover) {
  .sf-dialog-close:hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
    color: var(--sf-text-on-accent);
  }
}

.sf-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px 14px;
  overflow-y: auto;
}

.sf-dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--sf-border);
}

.sf-dialog-foot :deep(.sf-dialog-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  padding: 5px 14px;
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius-sm);
  background: var(--sf-bg);
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: 13px;
  cursor: pointer;
}

@media (hover: hover) {
  .sf-dialog-foot :deep(.sf-dialog-btn):hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
    color: var(--sf-text-bright);
  }
}

.sf-dialog-foot :deep(.sf-dialog-btn--accent) {
  background: var(--sf-accent);
  border-color: var(--sf-accent);
  color: var(--sf-text-on-accent);
}

@media (hover: hover) {
  .sf-dialog-foot :deep(.sf-dialog-btn--accent):hover {
    box-shadow: inset 0 0 0 999px var(--sf-hover-overlay);
    color: var(--sf-text-on-accent);
  }
}

.sf-root--mobile .sf-dialog-backdrop {
  padding: 10px;
}

.sf-root--mobile .sf-dialog {
  max-height: calc(100vh - 20px);
}

.sf-root--mobile .sf-dialog-head {
  gap: 0;
  min-height: 60px;
  padding: 0 0 0 14px;
}

.sf-root--mobile .sf-dialog-title {
  font-size: 16px;
}

.sf-root--mobile .sf-dialog-close {
  align-self: stretch;
  width: 60px;
  height: 60px;
  border: none;
  border-left: 1px solid var(--sf-border);
  border-radius: 0;
  font-size: 24px;
}

.sf-root--mobile .sf-dialog-foot {
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
}

.sf-root--mobile .sf-dialog-foot :deep(.sf-dialog-btn) {
  min-height: 44px;
  min-width: 96px;
  font-size: 15px;
}
</style>
