<script setup lang="ts">
import { inject, ref } from 'vue';
import { subtreeMinSize } from '../workspace/tree';
import { kWorkspace } from '../composables/useWorkspace';

const props = defineProps<{ index: number }>();
const ws = inject(kWorkspace)!;

const el = ref<HTMLElement | null>(null);
const dragging = ref(false);
let parentRect: DOMRect | null = null;
let leftStart = 0;
let combinedSize = 0;
let minLeft = 0;
let maxPos = 0;

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  dragging.value = true;
  el.value?.setPointerCapture(e.pointerId);

  const parent = el.value?.parentElement;
  if (!parent) return;
  parentRect = parent.getBoundingClientRect();

  const isRow = ws.rootDir === 'row';
  const left = ws.roots[props.index];
  const right = ws.roots[props.index + 1];
  if (!left || !right) return;

  // Root groups and sashes are interleaved: root, sash, root, sash, root, ...
  const leftEl = parent.children[props.index * 2] as HTMLElement;
  const rightEl = parent.children[props.index * 2 + 2] as HTMLElement;
  if (!leftEl || !rightEl) return;

  const leftRect = leftEl.getBoundingClientRect();
  const rightRect = rightEl.getBoundingClientRect();

  if (isRow) {
    leftStart = leftRect.left - parentRect.left;
    combinedSize = rightRect.right - leftRect.left;
  } else {
    leftStart = leftRect.top - parentRect.top;
    combinedSize = rightRect.bottom - leftRect.top;
  }

  minLeft = subtreeMinSize(left.node, isRow ? 'width' : 'height', ws.minTileWidth, ws.minTileHeight);
  maxPos = combinedSize - subtreeMinSize(right.node, isRow ? 'width' : 'height', ws.minTileWidth, ws.minTileHeight);

  document.body.classList.add(isRow ? 'sf-dragging-row' : 'sf-dragging-col');
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !parentRect) return;
  if (combinedSize <= 0) return;
  const isRow = ws.rootDir === 'row';
  const pos = (isRow ? e.clientX : e.clientY) - parentRect.left - leftStart;
  const minRatio = minLeft / combinedSize;
  const maxRatio = maxPos / combinedSize;
  const ratio = maxRatio > minRatio ? Math.min(Math.max(pos / combinedSize, minRatio), maxRatio) : 0.5;
  ws.ops.setRootRatio(props.index, ratio);
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  el.value?.releasePointerCapture(e.pointerId);
  parentRect = null;
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
