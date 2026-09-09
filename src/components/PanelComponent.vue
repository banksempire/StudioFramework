<script setup lang="ts">
import { computed, provide, reactive, watch } from 'vue';
import { kPanelAction } from '../composables/usePanelAction';
import { getPanelComponent, getPanelData } from '../registry';
import type {
  ButtonData,
  PanelAction,
  PanelBannerData,
  PanelComponent,
  PanelFormRow,
  PanelHeaderData,
  PanelListData,
  PanelListItem,
  PanelTableColumn,
  PanelTableData,
  TreeNode,
} from '../types/panel';
import { readUiStringArray, writeUiValue } from '../uiState';
import Icon from './Icon.vue';
import KeyValueList from './KeyValueList.vue';
import MenuButton from './MenuButton.vue';
import PanelBanner from './PanelBanner.vue';
import PanelForm from './PanelForm.vue';
import PanelHeader from './PanelHeader.vue';
import PanelList from './PanelList.vue';
import PanelTable from './PanelTable.vue';
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

function emitAction(action?: string, payload?: unknown) {
  emit('action', { source: props.component.type, action, payload });
}

const warned = new Set<string>();
const bindKeyOf = (c: PanelComponent): string | undefined => (c as { bind?: string }).bind;
const bound = computed<unknown>(() => {
  const key = bindKeyOf(props.component);
  if (!key) return undefined;
  const getter = getPanelData(key);
  if (!getter) {
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[sf] panel data "${key}" is not registered`);
    }
    return { __missing: key };
  }
  return getter();
});

const bindMissing = computed(() => !!(bound.value && (bound.value as { __missing?: string }).__missing));

const bindKey = computed(() => (bindMissing.value ? (bound.value as { __missing: string }).__missing : ''));

const customComp = computed(() =>
  props.component.type === 'component' ? (getPanelComponent(props.component.key) ?? null) : null,
);

const wrapStyle = computed(() => {
  const mh = props.component.maxHeight;
  return mh ? { maxHeight: `${mh}px`, overflowY: 'auto' as const } : undefined;
});

const kvItems = computed(() => {
  if (props.component.type !== 'keyValueList') return [];
  const b = bound.value;
  if (Array.isArray(b)) return b;
  const rec = b as { items?: PanelListItem[] } | undefined;
  return rec?.items ?? props.component.items ?? [];
});

const kvEmpty = computed(() => {
  if (props.component.type !== 'keyValueList') return undefined;
  const rec = bound.value as { empty?: string } | undefined;
  return rec?.empty ?? props.component.empty;
});

const listData = computed<PanelListData>(() => {
  if (props.component.type !== 'list') return { items: [] };
  const b = bound.value;
  if (Array.isArray(b)) return { items: b as PanelListItem[], empty: props.component.empty };
  const rec = b as PanelListData | undefined;
  if (rec && Array.isArray(rec.items)) return { items: rec.items, empty: rec.empty ?? props.component.empty };
  return { items: props.component.items ?? [], empty: props.component.empty };
});

const formData = computed<{ rows: PanelFormRow[]; empty?: string }>(() => {
  if (props.component.type !== 'form') return { rows: [] };
  const b = bound.value;
  if (Array.isArray(b)) return { rows: b as PanelFormRow[], empty: props.component.empty };
  const rec = b as { rows?: PanelFormRow[]; empty?: string } | undefined;
  if (rec && Array.isArray(rec.rows)) return { rows: rec.rows, empty: rec.empty ?? props.component.empty };
  return { rows: props.component.rows ?? [], empty: props.component.empty };
});

const headerData = computed<PanelHeaderData>(() => {
  if (props.component.type !== 'header') return {};
  const rec = (bound.value ?? {}) as PanelHeaderData;
  return {
    dot: rec.dot ?? props.component.dot,
    title: rec.title ?? props.component.title,
    tip: rec.tip ?? props.component.tip,
    sub: rec.sub ?? props.component.sub,
    disabled: rec.disabled,
  };
});

const headerActionId = computed(() => {
  if (props.component.type !== 'header') return undefined;
  return props.component.action?.action;
});

const bannerData = computed<PanelBannerData>(() => {
  if (props.component.type !== 'banner') return {};
  const b = bound.value;
  if (typeof b === 'string') return { text: b, tone: props.component.tone };
  const rec = (b ?? {}) as PanelBannerData;
  return { text: rec.text ?? props.component.text, tone: rec.tone ?? props.component.tone };
});

const tableData = computed<PanelTableData>(() => {
  if (props.component.type !== 'table') return { rows: [] };
  const rec = (bound.value ?? {}) as PanelTableData;
  return {
    rows: Array.isArray(rec.rows) ? rec.rows : [],
    empty: rec.empty ?? props.component.empty,
    note: rec.note,
    noteTone: rec.noteTone,
  };
});

const tableColumns = computed<PanelTableColumn[]>(() =>
  props.component.type === 'table' ? props.component.columns : [],
);

const menuItems = computed(() => {
  if (props.component.type !== 'menuButton') return [];
  const b = bound.value;
  if (Array.isArray(b)) return b;
  return props.component.items ?? [];
});

const menuButtonAction = computed(() => {
  if (props.component.type !== 'menuButton') return undefined;
  return props.component.action;
});

const buttonData = computed<ButtonData>(() => {
  if (props.component.type !== 'button') return {};
  const rec = (bound.value ?? {}) as ButtonData;
  return {
    label: rec.label ?? props.component.label,
    icon: rec.icon ?? props.component.icon,
    disabled: rec.disabled ?? props.component.disabled,
    title: rec.title ?? props.component.title,
  };
});

const textData = computed(() => {
  if (props.component.type !== 'text') return '';
  return typeof bound.value === 'string' ? bound.value : props.component.text;
});

const offNodes = reactive(new Set<string>());

const treeStateKey = computed(() => {
  if (props.component.type !== 'tree') return 'tree';
  return props.component.stateKey ?? props.component.bind ?? 'tree';
});

const expandByDefault = computed(() => {
  if (props.component.type !== 'tree') return false;
  return props.component.expandByDefault === true;
});

watch(
  [treeStateKey],
  ([key]) => {
    const saved = readUiStringArray(`panel.tree.state.${key}`);
    offNodes.clear();
    if (saved) for (const id of saved) offNodes.add(id);
  },
  { immediate: true },
);

watch(offNodes, () => {
  writeUiValue(`panel.tree.state.${treeStateKey.value}`, [...offNodes]);
});

function isExpanded(id: string): boolean {
  return expandByDefault.value ? !offNodes.has(id) : offNodes.has(id);
}

interface FlatNode {
  node: TreeNode;
  depth: number;
}

function flatten(nodes: TreeNode[], depth: number, acc: FlatNode[]): FlatNode[] {
  for (const node of nodes) {
    acc.push({ node, depth });
    if (isExpanded(node.id) && node.children?.length) {
      flatten(node.children, depth + 1, acc);
    }
  }
  return acc;
}

const treeNodes = computed<TreeNode[]>(() => {
  if (props.component.type !== 'tree') return [];
  const b = bound.value;
  if (Array.isArray(b)) return b;
  return props.component.nodes ?? [];
});

const flatTree = computed<FlatNode[]>(() => flatten(treeNodes.value, 0, []));

function hasChildren(node: TreeNode): boolean {
  return !!node.children?.length;
}

function toggleNode(id: string) {
  if (offNodes.has(id)) offNodes.delete(id);
  else offNodes.add(id);
  emit('content-changed');
}

function onNodeArrow(node: TreeNode) {
  if (hasChildren(node)) toggleNode(node.id);
}

function onNodeClick(node: TreeNode) {
  if (node.action) emitAction(node.action, node);
}
</script>

<template>
  <div class="sf-pc" :style="wrapStyle">
    <span v-if="bindMissing" class="sf-pc-bind-missing">no data: {{ bindKey }}</span>

    <span
      v-else-if="component.type === 'text'"
      class="sf-pc-text"
      :class="{ 'sf-pc-text--muted': component.muted }"
    >{{ textData }}</span>

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
      :class="'sf-pc-btn--' + (component.variant ?? 'default')"
      :disabled="buttonData.disabled"
      :title="buttonData.title"
      @click="emitAction(component.action)"
    >
      <Icon v-if="buttonData.icon" :icon="buttonData.icon" />
      {{ buttonData.label }}
    </button>

    <div v-else-if="component.type === 'tree'" class="sf-pc-tree">
      <div v-if="flatTree.length === 0 && component.empty" class="sf-empty">{{ component.empty }}</div>
      <div
        v-for="item in flatTree"
        :key="item.node.id"
        class="sf-pc-tree-node"
        :class="{
          'sf-pc-tree-node--checked': item.node.check === 'on',
          'sf-pc-tree-node--indet': item.node.check === 'mid',
        }"
        :style="{ paddingLeft: 4 + item.depth * 16 + 'px' }"
        :title="item.node.title"
        @click="onNodeClick(item.node)"
      >
        <span
          v-if="item.node.check"
          class="sf-pc-tree-check"
          :class="'sf-pc-tree-check--' + item.node.check"
        >
          <SvgIcon v-if="item.node.check === 'on'" name="✓" />
          <SvgIcon v-else-if="item.node.check === 'mid'" name="–" />
        </span>
        <span
          class="sf-pc-tree-arrow"
          :class="{
            'sf-pc-tree-arrow--expanded': isExpanded(item.node.id),
            'sf-pc-tree-arrow--leaf': !hasChildren(item.node),
          }"
          @click.stop="onNodeArrow(item.node)"
        ><SvgIcon v-if="hasChildren(item.node)" name="▸" /></span>
        <Icon v-if="item.node.icon" class="sf-pc-tree-icon" :icon="item.node.icon" />
        <span class="sf-pc-tree-label">{{ item.node.label }}</span>
        <span v-if="item.node.badge" class="sf-pc-tree-badge">{{ item.node.badge }}</span>
      </div>
    </div>

    <KeyValueList v-else-if="component.type === 'keyValueList'" :items="kvItems" :empty="kvEmpty" />

    <PanelList
      v-else-if="component.type === 'list'"
      :items="listData.items"
      :empty="listData.empty"
      :variant="component.variant"
      :dismiss-on-activate="component.dismissOnActivate"
      @activate="(it) => emitAction(it.action, { gesture: 'activate', id: it.id })"
      @menu="(it, optionId) => emitAction(it.action, { gesture: 'menu', id: it.id, option: optionId })"
      @button="(it, buttonId) => emitAction(it.action, { gesture: 'button', id: it.id, button: buttonId })"
      @switch-toggle="(it) => emitAction(it.action, { gesture: 'switch', id: it.id, value: !(it.switch?.on ?? false) })"
    />

    <PanelForm
      v-else-if="component.type === 'form'"
      :rows="formData.rows"
      :empty="formData.empty"
      @change="(row, value) => emitAction(row.action, { row: row.id, value })"
    />

    <PanelHeader
      v-else-if="component.type === 'header'"
      :data="headerData"
      :variant="component.variant"
      :action="component.action"
      @action-click="emitAction(headerActionId)"
    />

    <PanelBanner
      v-else-if="component.type === 'banner'"
      :text="bannerData.text"
      :tone="bannerData.tone"
    />

    <template v-else-if="component.type === 'table'">
      <PanelBanner :text="tableData.note" :tone="tableData.noteTone === 'error' ? 'error' : 'info'" />
      <PanelTable
        :columns="tableColumns"
        :rows="tableData.rows"
        :empty="tableData.empty"
        :resizable="component.resizable"
      />
    </template>

    <MenuButton
      v-else-if="component.type === 'menuButton'"
      :label="component.label"
      :icon="component.icon"
      :title="component.title"
      :items="menuItems"
      :disabled="component.disabled"
      @select="(item) => emitAction(menuButtonAction, item)"
    />

    <component
      v-else-if="customComp"
      :is="customComp"
      v-bind="component.type === 'component' ? (component.props ?? {}) : {}"
    />
  </div>
</template>
