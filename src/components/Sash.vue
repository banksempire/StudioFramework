<script setup lang="ts">
import { inject, ref } from 'vue';
import { subtreeMinSize, type SplitNode } from '../workspace/tree';
import { kWorkspace } from '../composables/useWorkspace';

const props = defineProps<{ split: SplitNode }>();
const ws = inject(kWorkspace)!;

const el = ref<HTMLElement | null>(null);

let dragging = false;
let parentRect: DOMRect | null = null;
let minA = 0;
let maxPos = 0;

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  dragging = true;
  el.value?.setPointerCapture(e.pointerId);
  const parent = el.value?.parentElement;
  if (!parent) return;
  parentRect = parent.getBoundingClientRect();
  const [a, b] = props.split.children;
  const dim = props.split.dir === 'row' ? 'width' : 'height';
  minA = subtreeMinSize(a, dim, ws.minTileWidth, ws.minTileHeight);
  maxPos = (props.split.dir === 'row' ? parentRect.width : parentRect.height) - subtreeMinSize(b, dim, ws.minTileWidth, ws.minTileHeight);
  document.body.classList.add('sf-dragging');
}

function onPointerMove(e: PointerEvent) {
  if (!dragging || !parentRect) return;
  const isRow = props.split.dir === 'row';
  const size = isRow ? parentRect.width : parentRect.height;
  if (size <= 0) return;
  const pos = (isRow ? e.clientX : e.clientY) - (isRow ? parentRect.left : parentRect.top);
  const minRatio = minA / size;
  const maxRatio = maxPos / size;
  // If the container is smaller than both mins, fall back to a fair share.
  const ratio = maxRatio > minRatio ? Math.min(Math.max(pos / size, minRatio), maxRatio) : 0.5;
  ws.ops.setRatio(props.split.id, ratio);
}

function onPointerUp(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  el.value?.releasePointerCapture(e.pointerId);
  parentRect = null;
  document.body.classList.remove('sf-dragging');
}
</script>

<template>
  <div
    ref="el"
    class="sf-sash"
    :class="split.dir === 'row' ? 'sf-sash--row' : 'sf-sash--column'"
    title="Drag to resize"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  />
</template>
