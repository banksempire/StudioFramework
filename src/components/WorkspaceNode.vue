<script setup lang="ts">
import { computed } from 'vue';
import { useWorkspaceContext } from '../composables/useWorkspace';
import { subtreeMinSize, type WorkspaceNode as WorkspaceNodeType } from '../workspace/tree';
import Sash from './Sash.vue';
import Tile from './Tile.vue';

const props = defineProps<{ node: WorkspaceNodeType }>();
const ws = useWorkspaceContext();

const tileNode = computed(() => (props.node.kind === 'tile' ? props.node : null));
const splitNode = computed(() => (props.node.kind === 'split' ? props.node : null));

function childStyle(i: 0 | 1) {
  const split = splitNode.value;
  if (!split) return {};
  const child = split.children[i];
  const basis = (i === 0 ? split.ratio : 1 - split.ratio) * 100;
  return {
    flexBasis: `${basis}%`,
    minWidth: `${subtreeMinSize(child, 'width', ws.minTileWidth, ws.minTileHeight)}px`,
    minHeight: `${subtreeMinSize(child, 'height', ws.minTileWidth, ws.minTileHeight)}px`,
  };
}
</script>

<template>
  <Tile v-if="tileNode" :tile="tileNode" />
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
