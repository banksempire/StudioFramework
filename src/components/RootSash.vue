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
let combinedWidth = 0;
let minLeft = 0;
let maxPos = 0;

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  dragging.value = true;
  el.value?.setPointerCapture(e.pointerId);

  const parent = el.value?.parentElement;
  if (!parent) return;
  parentRect = parent.getBoundingClientRect();

  const left = ws.roots[props.index];
  const right = ws.roots[props.index + 1];
  if (!left || !right) return;

  // Compute the pixel positions of the two adjacent roots
  const leftEl = parent.children[props.index * 2] as HTMLElement; // root, sash, root, sash, ...
  const rightEl = parent.children[props.index * 2 + 2] as HTMLElement;
  if (!leftEl || !rightEl) return;

  const leftRect = leftEl.getBoundingClientRect();
  const rightRect = rightEl.getBoundingClientRect();
  leftStart = leftRect.left - parentRect.left;
  combinedWidth = (rightRect.right - leftRect.left);

  minLeft = subtreeMinSize(left.node, 'width', ws.minTileWidth, ws.minTileHeight);
  maxPos = combinedWidth - subtreeMinSize(right.node, 'width', ws.minTileWidth, ws.minTileHeight);

  document.body.classList.add('sf-dragging-row');
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !parentRect) return;
  if (combinedWidth <= 0) return;
  const pos = e.clientX - parentRect.left - leftStart;
  const minRatio = minLeft / combinedWidth;
  const maxRatio = maxPos / combinedWidth;
  const ratio = maxRatio > minRatio ? Math.min(Math.max(pos / combinedWidth, minRatio), maxRatio) : 0.5;
  ws.ops.setRootRatio(props.index, ratio);
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  el.value?.releasePointerCapture(e.pointerId);
  parentRect = null;
  document.body.classList.remove('sf-dragging-row');
}
</script>

<template>
  <div
    ref="el"
    class="sf-sash sf-sash--row"
    :class="{ 'sf-sash--dragging': dragging }"
    title="Drag to resize"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  />
</template>
