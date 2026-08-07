<script setup lang="ts">
import { computed, provide, reactive } from 'vue';
import Icon from './Icon.vue';
import KeyValueList from './KeyValueList.vue';
import { getPanelComponent } from '../registry';
import { kPanelAction } from '../composables/usePanelAction';
import type { PanelAction, PanelComponent, TreeNode } from '../types/panel';

const props = defineProps<{
  component: PanelComponent;
}>();

const emit = defineEmits<{
  action: [action: PanelAction];
  'content-changed': [];
}>();

/**
 * Custom components (type: 'component') dispatch actions upward through
 * this injection. The source is set to the component's layout key so the
 * host app can tell which component produced the action.
 */
provide(kPanelAction, (action: Omit<PanelAction, 'source'>) => {
  if (props.component.type !== 'component') return;
  emit('action', { source: props.component.key, action: action.action, payload: action.payload });
});

const customComp = computed(() =>
  props.component.type === 'component' ? getPanelComponent(props.component.key) ?? null : null,
);

function emitAction(action?: string, payload?: unknown) {
  emit('action', { source: props.component.type, action, payload });
}

// ── Tree state ─────────────────────────────────────────────────────────────

// reactive Set: add/delete trigger updates directly (no manual re-assignment)
const expandedNodes = reactive(new Set<string>());

interface FlatNode {
  node: TreeNode;
  depth: number;
}

function flatten(nodes: TreeNode[], depth: number, acc: FlatNode[]): FlatNode[] {
  for (const node of nodes) {
    acc.push({ node, depth });
    if (expandedNodes.has(node.id) && node.children?.length) {
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
  if (expandedNodes.has(id)) expandedNodes.delete(id);
  else expandedNodes.add(id);
  emit('content-changed');
}

function onNodeClick(node: TreeNode) {
  if (hasChildren(node)) {
    toggleNode(node.id);
  } else if (node.action) {
    emitAction(node.action, node);
  }
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
      @click="emitAction(component.action)"
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
        @click="onNodeClick(item.node)"
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

    <!-- Key-Value List (unified KeyValueList component) -->
    <KeyValueList v-else-if="component.type === 'keyValueList'" :items="component.items" />

    <!-- List -->
    <div v-else-if="component.type === 'list'" class="sf-pc-list">
      <div
        v-for="item in component.items"
        :key="item.id"
        class="sf-pc-list-item"
        @click="emitAction(item.action, item)"
      >
        <Icon v-if="item.icon" class="sf-pc-list-icon" :icon="item.icon" />
        <span class="sf-pc-list-label">{{ item.label }}</span>
        <span v-if="item.badge" class="sf-pc-list-badge">{{ item.badge }}</span>
      </div>
    </div>

    <!-- Custom (app-registered) component -->
    <component
      v-else-if="customComp"
      :is="customComp"
      v-bind="component.type === 'component' ? (component.props ?? {}) : {}"
    />
  </div>
</template>
