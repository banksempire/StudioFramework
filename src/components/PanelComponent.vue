<script setup lang="ts">
import { computed, h, defineComponent } from 'vue';
import type {
  PanelComponent as PanelComponentType,
  TreeComponent,
  TreeNode,
  TableComponent,
  KeyValueListComponent,
  SliderComponent,
  DropdownComponent,
  TextBoxComponent,
  CheckboxComponent,
  ButtonComponent,
  LabelComponent,
} from '../types/panel.js';

const props = defineProps<{
  def: PanelComponentType;
}>();

const emit = defineEmits<{
  'change': [componentId: string, value: unknown];
}>();

// ── Recursive tree node ───────────────────────────────────────────────────

const TreeNodeItem = defineComponent({
  name: 'TreeNodeItem',
  props: {
    node: { type: Object as () => TreeNode, required: true },
    depth: { type: Number, default: 0 },
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () => {
      const n = props.node;
      const indentCls = 'sf-tree-indent-' + Math.min(props.depth, 6);
      return h('div', { class: 'sf-tree-children' }, [
        h('div', {
          class: ['sf-tree-node', indentCls],
          onClick: () => emit('toggle', n),
        }, [
          n.children?.length
            ? h('span', { class: 'sf-tree-arrow' }, n.expanded ? '▼' : '▶')
            : h('span', { class: 'sf-tree-arrow-spacer' }),
          n.icon ? h('span', { class: 'sf-tree-icon' }, n.icon) : null,
          h('span', { class: 'sf-tree-label' }, n.label),
        ]),
        n.expanded && n.children
          ? n.children.map((child: TreeNode) =>
              h(TreeNodeItem, {
                key: child.id,
                node: child,
                depth: props.depth + 1,
                onToggle: (cn: TreeNode) => emit('toggle', cn),
              }),
            )
          : null,
      ]);
    };
  },
});

// ── Tree root ─────────────────────────────────────────────────────────────

const treeDef = computed(() =>
  props.def.type === 'tree' ? (props.def as TreeComponent) : null,
);

function toggleNode(node: TreeNode) {
  node.expanded = !node.expanded;
}

// ── Table ─────────────────────────────────────────────────────────────────

const tableData = computed(() =>
  (props.def as TableComponent).type === 'table'
    ? props.def as TableComponent
    : null,
);

// ── KeyValueList ──────────────────────────────────────────────────────────

const kvData = computed(() =>
  (props.def as KeyValueListComponent).type === 'keyValueList'
    ? props.def as KeyValueListComponent
    : null,
);

// ── Slider ────────────────────────────────────────────────────────────────

const sliderData = computed(() =>
  (props.def as SliderComponent).type === 'slider'
    ? props.def as SliderComponent
    : null,
);

function onSliderInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  emit('change', props.def.id, val);
}

// ── Dropdown ──────────────────────────────────────────────────────────────

const dropdownData = computed(() =>
  (props.def as DropdownComponent).type === 'dropdown'
    ? props.def as DropdownComponent
    : null,
);

function onDropdownChange(e: Event) {
  emit('change', props.def.id, (e.target as HTMLSelectElement).value);
}

// ── TextBox ───────────────────────────────────────────────────────────────

const textBoxData = computed(() =>
  (props.def as TextBoxComponent).type === 'textBox'
    ? props.def as TextBoxComponent
    : null,
);

function onTextBoxInput(e: Event) {
  emit('change', props.def.id, (e.target as HTMLInputElement).value);
}

// ── Checkbox ──────────────────────────────────────────────────────────────

const checkboxData = computed(() =>
  (props.def as CheckboxComponent).type === 'checkbox'
    ? props.def as CheckboxComponent
    : null,
);

function onCheckboxChange(e: Event) {
  emit('change', props.def.id, (e.target as HTMLInputElement).checked);
}

// ── Button ────────────────────────────────────────────────────────────────

const buttonData = computed(() =>
  (props.def as ButtonComponent).type === 'button'
    ? props.def as ButtonComponent
    : null,
);

function onButtonClick() {
  emit('change', props.def.id, true);
}

// ── Label ─────────────────────────────────────────────────────────────────

const labelData = computed(() =>
  (props.def as LabelComponent).type === 'label'
    ? props.def as LabelComponent
    : null,
);
</script>

<template>
  <!-- Tree -->
  <div v-if="def.type === 'tree' && treeDef" class="sf-component sf-tree">
    <TreeNodeItem
      v-for="node in treeDef.contents"
      :key="node.id"
      :node="node"
      :depth="0"
      @toggle="toggleNode"
    />
  </div>

  <!-- Table -->
  <div v-else-if="def.type === 'table' && tableData" class="sf-component sf-table">
    <table>
      <thead>
        <tr>
          <th v-for="col in tableData.contents.columns" :key="col.key">
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in tableData.contents.rows" :key="ri">
          <td v-for="col in tableData.contents.columns" :key="col.key">
            {{ row[col.key] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- KeyValueList -->
  <div v-else-if="def.type === 'keyValueList' && kvData" class="sf-component sf-kv-list">
    <div
      v-for="item in kvData.contents"
      :key="item.key"
      class="sf-kv-item"
    >
      <span class="sf-kv-key">{{ item.key }}</span>
      <span class="sf-kv-value" :class="{ 'sf-kv-value--readonly': item.readOnly }">
        {{ item.value }}
      </span>
    </div>
  </div>

  <!-- Slider -->
  <div v-else-if="def.type === 'slider' && sliderData" class="sf-component sf-slider-field">
    <label v-if="sliderData.contents.label">{{ sliderData.contents.label }}</label>
    <div class="sf-slider-row">
      <input
        type="range"
        :min="sliderData.contents.min"
        :max="sliderData.contents.max"
        :step="sliderData.contents.step || 1"
        :value="sliderData.contents.value"
        @input="onSliderInput"
      />
      <span class="sf-slider-value">{{ sliderData.contents.value }}</span>
    </div>
  </div>

  <!-- Dropdown -->
  <div v-else-if="def.type === 'dropdown' && dropdownData" class="sf-component sf-dropdown-field">
    <label v-if="dropdownData.contents.label">{{ dropdownData.contents.label }}</label>
    <select :value="dropdownData.contents.value" @change="onDropdownChange">
      <option v-for="opt in dropdownData.contents.options" :key="opt" :value="opt">
        {{ opt }}
      </option>
    </select>
  </div>

  <!-- TextBox -->
  <div v-else-if="def.type === 'textBox' && textBoxData" class="sf-component sf-textbox-field">
    <label v-if="textBoxData.contents.label">{{ textBoxData.contents.label }}</label>
    <input
      type="text"
      :value="textBoxData.contents.value"
      :placeholder="textBoxData.contents.placeholder"
      @input="onTextBoxInput"
    />
  </div>

  <!-- Checkbox -->
  <div v-else-if="def.type === 'checkbox' && checkboxData" class="sf-component sf-checkbox-field">
    <label>
      <input
        type="checkbox"
        :checked="checkboxData.contents.checked"
        @change="onCheckboxChange"
      />
      {{ checkboxData.contents.label }}
    </label>
  </div>

  <!-- Button -->
  <button
    v-else-if="def.type === 'button' && buttonData"
    class="sf-component sf-btn"
    :class="'sf-btn--' + (buttonData.contents.variant || 'secondary')"
    @click="onButtonClick"
  >
    {{ buttonData.contents.label }}
  </button>

  <!-- Label -->
  <span v-else-if="def.type === 'label' && labelData" class="sf-component sf-label-text">
    {{ labelData.contents.text }}
  </span>
</template>
