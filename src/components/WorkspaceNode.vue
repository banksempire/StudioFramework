<script setup lang="ts">
import { computed, inject } from 'vue';
import { subtreeMinSize, type WorkspaceNode as WorkspaceNodeType } from '../workspace/tree';
import { kWorkspace } from '../composables/useWorkspace';
import Sash from './Sash.vue';
import EditorTile from './EditorTile.vue';

const props = defineProps<{ node: WorkspaceNodeType }>();
const ws = inject(kWorkspace)!;

const tileNode = computed(() => (props.node.kind === 'tile' ? props.node : null));
const splitNode = computed(() => (props.node.kind === 'split' ? props.node : null));

/**
 * Flexbox sizing: the ratio is baked into flex-basis, so window resizes
 * keep tiles proportional automatically. Min sizes act as the floor —
 * the proportion is only broken when a min size is reached.
 */
function childStyle(i: 0 | 1) {
  const split = splitNode.value!;
  const child = split.children[i];
  const basis = (i === 0 ? split.ratio : 1 - split.ratio) * 100;
  return {
    flexBasis: basis + '%',
    minWidth: subtreeMinSize(child, 'width', ws.minTileWidth, ws.minTileHeight) + 'px',
    minHeight: subtreeMinSize(child, 'height', ws.minTileWidth, ws.minTileHeight) + 'px',
  };
}
</script>

<template>
  <EditorTile v-if="tileNode" :tile="tileNode" />
  <div v-else class="sf-split" :class="splitNode!.dir === 'row' ? 'sf-split--row' : 'sf-split--column'">
    <div class="sf-split-child" :style="childStyle(0)">
      <WorkspaceNode :node="splitNode!.children[0]" />
    </div>
    <Sash :split="splitNode!" />
    <div class="sf-split-child" :style="childStyle(1)">
      <WorkspaceNode :node="splitNode!.children[1]" />
    </div>
  </div>
</template>
