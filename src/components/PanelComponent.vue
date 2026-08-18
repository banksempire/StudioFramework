<script setup lang="ts">
import { computed, provide, reactive } from 'vue';
import { kPanelAction } from '../composables/usePanelAction';
import { getPanelComponent } from '../registry';
import type { PanelAction, PanelComponent, TreeNode } from '../types/panel';
import Icon from './Icon.vue';
import KeyValueList from './KeyValueList.vue';
import SvgIcon from './SvgIcon.vue';

const props = defineProps<{
  component: PanelComponent;
}>();

const emit = defineEmits<{
  action: [action: PanelAction];
  'content-changed': [];
}>();

provide(kPanelAction, (action: Omit<PanelAction, 'source'>) => {
  if (props.component.type !== 'component') return;
  emit('action', { source: props.component.key, action: action.action, payload: action.payload });
});

const customComp = computed(() =>
  props.component.type === 'component' ? (getPanelComponent(props.component.key) ?? null) : null,
);

function emitAction(action?: string, payload?: unknown) {
  emit('action', { source: props.component.type, action, payload });
}

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
    <span
      v-if="component.type === 'text'"
      class="sf-pc-text"
      :class="{ 'sf-pc-text--muted': component.muted }"
    >{{ component.text }}</span>

    <input
      v-else-if="component.type === 'input'"
      class="sf-pc-input"
      type="text"
      :value="component.value"
      :placeholder="component.placeholder"
    />

    <button
      v-else-if="component.type === 'button'"
      class="sf-pc-btn"
      @click="emitAction(component.action)"
    >
      <Icon v-if="component.icon" :icon="component.icon" />
      {{ component.label }}
    </button>

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
        ><SvgIcon v-if="hasChildren(item.node)" name="▸" /></span>
        <Icon v-if="item.node.icon" class="sf-pc-tree-icon" :icon="item.node.icon" />
        <span class="sf-pc-tree-label">{{ item.node.label }}</span>
        <span v-if="item.node.badge" class="sf-pc-tree-badge">{{ item.node.badge }}</span>
      </div>
    </div>

    <KeyValueList v-else-if="component.type === 'keyValueList'" :items="component.items" />

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

    <component
      v-else-if="customComp"
      :is="customComp"
      v-bind="component.type === 'component' ? (component.props ?? {}) : {}"
    />
  </div>
</template>
