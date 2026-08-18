<script setup lang="ts">
import { ref } from 'vue';
import { useWorkspaceContext } from '../composables/useWorkspace';
import { subtreeMinSize } from '../workspace/tree';

const props = defineProps<{ index: number }>();
const ws = useWorkspaceContext();

const el = ref<HTMLElement | null>(null);
const dragging = ref(false);
let startPos = 0;
let combinedSize = 0;
let minLeft = 0;
let maxPos = 0;

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  dragging.value = true;
  el.value?.setPointerCapture(e.pointerId);

  const leftEl = el.value?.previousElementSibling as HTMLElement | null;
  const rightEl = el.value?.nextElementSibling as HTMLElement | null;
  if (!leftEl || !rightEl) return;

  const isRow = ws.rootDir === 'row';
  const left = ws.roots[props.index];
  const right = ws.roots[props.index + 1];
  if (!left || !right) return;

  const leftRect = leftEl.getBoundingClientRect();
  const rightRect = rightEl.getBoundingClientRect();

  if (isRow) {
    startPos = leftRect.left;
    combinedSize = rightRect.right - leftRect.left;
  } else {
    startPos = leftRect.top;
    combinedSize = rightRect.bottom - leftRect.top;
  }

  minLeft = subtreeMinSize(left.node, isRow ? 'width' : 'height', ws.minTileWidth, ws.minTileHeight);
  maxPos =
    combinedSize - subtreeMinSize(right.node, isRow ? 'width' : 'height', ws.minTileWidth, ws.minTileHeight);

  document.body.classList.add(isRow ? 'sf-dragging-row' : 'sf-dragging-col');
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || combinedSize <= 0) return;
  const isRow = ws.rootDir === 'row';
  const pos = (isRow ? e.clientX : e.clientY) - startPos;
  const minRatio = minLeft / combinedSize;
  const maxRatio = maxPos / combinedSize;
  const ratio = maxRatio > minRatio ? Math.min(Math.max(pos / combinedSize, minRatio), maxRatio) : 0.5;
  ws.ops.setRootRatio(props.index, ratio);
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  el.value?.releasePointerCapture(e.pointerId);
  document.body.classList.remove('sf-dragging-row');
  document.body.classList.remove('sf-dragging-col');
}
</script>

<template>
  <div
    ref="el"
    class="sf-sash"
    :class="[
      ws.rootDir === 'row' ? 'sf-sash--row' : 'sf-sash--column',
      { 'sf-sash--dragging': dragging },
    ]"
    title="Drag to resize"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  />
</template>
