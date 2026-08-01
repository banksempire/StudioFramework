<script setup lang="ts">
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import type { PanelComponent, TreeNode } from '../types/panel';

const props = defineProps<{
  component: PanelComponent;
}>();

const emit = defineEmits<{
  action: [];
  'content-changed': [];
}>();

// ── Tree state ─────────────────────────────────────────────────────────────

const expandedNodes = ref<Set<string>>(new Set());

interface FlatNode {
  node: TreeNode;
  depth: number;
}

function flatten(nodes: TreeNode[], depth: number, acc: FlatNode[]): FlatNode[] {
  for (const node of nodes) {
    acc.push({ node, depth });
    if (expandedNodes.value.has(node.id) && node.children?.length) {
      flatten(node.children, depth + 1, acc);
    }
  }
  return acc;
}

const flatTree = computed<FlatNode[]>(() => {
  if (props.component.type !== 'tree') return [];
  return flatten(props.component.nodes, 0, []);
});

function hasChildren(node: TreeNode): boolean {
  return !!node.children?.length;
}

function toggleNode(id: string) {
  if (expandedNodes.value.has(id)) {
    expandedNodes.value.delete(id);
  } else {
    expandedNodes.value.add(id);
  }
  expandedNodes.value = new Set(expandedNodes.value);
  emit('content-changed');
}
</script>

<template>
  <div class="sf-pc">
    <!-- Text -->
    <span
      v-if="component.type === 'text'"
      class="sf-pc-text"
      :class="{ 'sf-pc-text--muted': component.muted }"
    >{{ component.text }}</span>

    <!-- Input -->
    <input
      v-else-if="component.type === 'input'"
      class="sf-pc-input"
      type="text"
      :value="component.value"
      :placeholder="component.placeholder"
    />

    <!-- Button -->
    <button
      v-else-if="component.type === 'button'"
      class="sf-pc-btn"
      @click="emit('action')"
    >
      <Icon v-if="component.icon" :icon="component.icon" />
      {{ component.label }}
    </button>

    <!-- Tree -->
    <div v-else-if="component.type === 'tree'" class="sf-pc-tree">
      <div
        v-for="item in flatTree"
        :key="item.node.id"
        class="sf-pc-tree-node"
        :style="{ paddingLeft: 4 + item.depth * 16 + 'px' }"
        @click="hasChildren(item.node) && toggleNode(item.node.id)"
      >
        <span
          class="sf-pc-tree-arrow"
          :class="{
            'sf-pc-tree-arrow--expanded': expandedNodes.has(item.node.id),
            'sf-pc-tree-arrow--leaf': !hasChildren(item.node),
          }"
        >{{ hasChildren(item.node) ? '▸' : '' }}</span>
        <Icon v-if="item.node.icon" class="sf-pc-tree-icon" :icon="item.node.icon" />
        <span class="sf-pc-tree-label">{{ item.node.label }}</span>
        <span v-if="item.node.badge" class="sf-pc-tree-badge">{{ item.node.badge }}</span>
      </div>
    </div>

    <!-- Key-Value List -->
    <div v-else-if="component.type === 'keyValueList'" class="sf-pc-kv">
      <div v-for="item in component.items" :key="item.key" class="sf-pc-kv-row">
        <span class="sf-pc-kv-key">{{ item.key }}</span>
        <span class="sf-pc-kv-val">{{ item.value }}</span>
      </div>
    </div>

    <!-- List -->
    <div v-else-if="component.type === 'list'" class="sf-pc-list">
      <div v-for="item in component.items" :key="item.id" class="sf-pc-list-item">
        <Icon v-if="item.icon" class="sf-pc-list-icon" :icon="item.icon" />
        <span class="sf-pc-list-label">{{ item.label }}</span>
        <span v-if="item.badge" class="sf-pc-list-badge">{{ item.badge }}</span>
      </div>
    </div>
  </div>
</template>
