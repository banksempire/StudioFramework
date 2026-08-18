<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, type Ref, ref, toRaw, watch } from 'vue';
import { kIsMobile } from '../composables/useWorkspace';
import type { MenuNodeDef } from '../types/layout';
import Icon from './Icon.vue';
import SvgIcon from './SvgIcon.vue';

const props = withDefaults(
  defineProps<{
    items: MenuNodeDef[];
    open?: boolean;
    closeOnSelect?: boolean;
    embedded?: boolean;
    title?: string;
    depth?: number;
    boxStyle?: { left: string; top: string; parentLeft?: number };
    hoverPath?: Ref<MenuNodeDef[]>;
    subPos?: Ref<Record<number, { left: string; top: string; parentLeft?: number }>>;
    hoverItem?: (item: MenuNodeDef, rect: DOMRect, depth: number) => void;
  }>(),
  {
    open: false,
    closeOnSelect: true,
    embedded: false,
    depth: 0,
    hoverPath: () => ref<MenuNodeDef[]>([]),
    subPos: () => ref<Record<number, { left: string; top: string; parentLeft?: number }>>({}),
    hoverItem: () => {},
  },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [item: MenuNodeDef];
}>();

function sameMenu(a: MenuNodeDef | undefined, b: MenuNodeDef | undefined): boolean {
  return !!a && !!b && toRaw(a) === toRaw(b);
}

const injectedMobile = inject(kIsMobile, null);
const mobile = computed(() => injectedMobile?.value ?? false);

const sheetItems = computed<MenuNodeDef[]>(() => {
  const top = rootHoverPath.value[rootHoverPath.value.length - 1];
  return top?.items?.length ? top.items : props.items;
});

const sheetGroups = computed<MenuNodeDef[][]>(() => {
  const groups: MenuNodeDef[][] = [];
  let cur: MenuNodeDef[] = [];
  for (const item of sheetItems.value) {
    if (item.separator) {
      if (cur.length) {
        groups.push(cur);
        cur = [];
      }
    } else {
      cur.push(item);
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
});

function onSheetRowClick(item: MenuNodeDef) {
  if (item.disabled || item.separator) return;
  if (item.items?.length) {
    rootHoverPath.value.push(item);
    return;
  }
  close();
  emit('select', item);
}

function onSheetBack() {
  rootHoverPath.value.pop();
}

const rootHoverPath = ref<MenuNodeDef[]>([]);
const rootSubPos = ref<Record<number, { left: string; top: string; parentLeft?: number }>>({});
const menuState = { hoverPath: rootHoverPath, subPos: rootSubPos };

function positionFor(rect: DOMRect): { left: string; top: string; parentLeft: number } {
  const W = 224;
  let left = rect.right + 2;
  if (left + W > window.innerWidth - 4) left = rect.left - W - 2;
  if (left < 4) left = 4;
  const top = Math.max(4, Math.min(rect.top - 4, window.innerHeight - 240));
  return { left: `${left}px`, top: `${top}px`, parentLeft: rect.left };
}

function handleHover(item: MenuNodeDef, rect: DOMRect, depth: number) {
  if (item.disabled) return;
  if (item.items?.length) {
    rootHoverPath.value.splice(depth, rootHoverPath.value.length - depth, item);
    rootSubPos.value[depth + 1] = positionFor(rect);
  } else {
    rootHoverPath.value.splice(depth);
    delete rootSubPos.value[depth + 1];
  }
}

const childItems = computed<MenuNodeDef[]>(() => {
  const path = props.embedded ? props.hoverPath?.value : rootHoverPath.value;
  const node = path?.[props.depth];
  return node?.items?.length ? node.items : [];
});
const hasChildItems = computed(() => childItems.value.length > 0);

const anchorEl = ref<HTMLElement | null>(null);
const popEl = ref<HTMLElement | null>(null);
const regionEl = ref<HTMLElement | null>(null);
const popStyle = ref({ left: '0px', top: '0px' });

const sheetTarget = ref<HTMLElement | 'body'>('body');
if (!props.embedded && typeof window !== 'undefined') {
  onMounted(() => {
    sheetTarget.value = (document.querySelector('.sf-root') as HTMLElement | null) ?? 'body';
  });
}

function close() {
  emit('update:open', false);
}

async function positionPopup() {
  await nextTick();
  const anchor = anchorEl.value;
  const pop = popEl.value;
  if (!anchor || !pop) return;
  const trigger = anchor.firstElementChild ?? anchor;
  const a = trigger.getBoundingClientRect();
  const w = pop.offsetWidth || 220;
  const h = pop.offsetHeight || 40;
  let left = a.left;
  if (left + w > window.innerWidth - 4) left = Math.max(4, window.innerWidth - w - 4);
  let top = a.bottom + 2;
  if (top + h > window.innerHeight - 4) top = Math.max(4, a.top - h - 2);
  popStyle.value = { left: `${left}px`, top: `${top}px` };
}

watch(
  () => props.open,
  (o) => {
    if (o) {
      rootHoverPath.value.length = 0;
      rootSubPos.value = {};
      if (!mobile.value) void positionPopup();
    } else {
      rootHoverPath.value.length = 0;
    }
  },
);

const boxEl = ref<HTMLElement | null>(null);
const adjustedLeft = ref<string | null>(null);
async function adjustBox() {
  await nextTick();
  const bs = props.boxStyle;
  const el = boxEl.value;
  if (!bs || !el || bs.parentLeft === undefined) return;
  const w = el.offsetWidth;
  const left = parseFloat(bs.left) || 0;
  const right = left + w;
  if (left < bs.parentLeft && right > bs.parentLeft - 2) {
    adjustedLeft.value = `${Math.max(4, bs.parentLeft - w - 2)}px`;
  } else if (left >= bs.parentLeft && right > window.innerWidth - 4) {
    adjustedLeft.value = `${Math.max(4, bs.parentLeft - w - 2)}px`;
  } else {
    adjustedLeft.value = null;
  }
}
if (props.embedded) {
  onMounted(() => void adjustBox());
  watch(
    () => props.boxStyle,
    () => void adjustBox(),
  );
}

function onEnter(e: MouseEvent, item: MenuNodeDef, depth: number) {
  if (item.disabled) return;
  const fn = props.embedded ? (props.hoverItem ?? handleHover) : handleHover;
  fn(item, (e.currentTarget as HTMLElement).getBoundingClientRect(), depth);
}

function onRowClick(item: MenuNodeDef) {
  if (item.disabled || item.separator) return;
  if (item.items?.length) return;
  if (props.closeOnSelect && !props.embedded) close();
  emit('select', item);
}

function onEmbeddedSelect(item: MenuNodeDef) {
  if (props.closeOnSelect) close();
  emit('select', item);
}

function onDocDown(e: MouseEvent) {
  if (!props.open || mobile.value) return;
  const t = e.target as Node;
  if (anchorEl.value?.contains(t) || regionEl.value?.contains(t)) return;
  close();
}

function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close();
}

if (!props.embedded && typeof window !== 'undefined') {
  window.addEventListener('mousedown', onDocDown);
  window.addEventListener('keydown', onDocKey);
  onUnmounted(() => {
    window.removeEventListener('mousedown', onDocDown);
    window.removeEventListener('keydown', onDocKey);
  });
}
</script>

<template>
  <template v-if="!embedded">
    <span ref="anchorEl" class="sf-menu-anchor">
      <slot name="trigger" :toggle="() => emit('update:open', !open)" :open="open" />
    </span>

    <Teleport :to="sheetTarget">
      <div v-if="open && mobile" class="sf-menu-sheet">
      <div class="sf-menu-sheet-bar">
        <button
          v-if="rootHoverPath.length > 0"
          class="sf-menu-sheet-back"
          title="Back"
          @click="onSheetBack"
        ><SvgIcon name="←" /></button>
        <span class="sf-menu-sheet-title">{{
          rootHoverPath.length > 0
            ? rootHoverPath[rootHoverPath.length - 1].label
            : (props.title ?? 'menu')
        }}</span>
        <button class="sf-menu-sheet-close" title="Close menu" @click="close"><SvgIcon name="✕" /></button>
      </div>
      <div class="sf-menu-sheet-body">
        <div v-for="(group, gi) in sheetGroups" :key="`group-${gi}`" class="sf-menu-group">
          <div
            v-for="(item, i) in group"
            :key="item.id ?? `item-${i}`"
            class="sf-menu-row"
            :class="{
              'sf-menu-row--disabled': item.disabled,
              'sf-menu-row--selected': item.selected && !item.iconKind,
            }"
            @click="onSheetRowClick(item)"
          >
            <span class="sf-menu-cell sf-menu-cell--icon">
              <Icon v-if="item.icon" :icon="item.icon" />
              <span v-else-if="item.iconKind === 'check'" class="sf-menu-mark"><SvgIcon v-if="item.selected" name="✓" /></span>
              <span v-else-if="item.iconKind === 'dot'" class="sf-menu-mark"><SvgIcon v-if="item.selected" name="●" /></span>
            </span>
            <span class="sf-menu-cell sf-menu-cell--label">{{ item.label }}</span>
            <span v-if="item.detail || item.accelerator" class="sf-menu-cell sf-menu-cell--hint">
              {{ item.detail ?? item.accelerator }}
            </span>
            <span v-if="item.items?.length" class="sf-menu-cell sf-menu-cell--arrow"><SvgIcon name="▶" /></span>
          </div>
        </div>
      </div>
      </div>
    </Teleport>

    <div v-if="open && !mobile" ref="regionEl" class="sf-menu-region">
      <div ref="popEl" class="sf-menu-pop" :style="popStyle">
        <div class="sf-menu-scroll">
          <template v-for="(item, i) in items" :key="item.id ?? `sep-${i}`">
            <div v-if="item.separator" class="sf-menu-separator" />
            <div
              v-else
              class="sf-menu-row"
              :class="{
                'sf-menu-row--disabled': item.disabled,
                'sf-menu-row--open': sameMenu(menuState.hoverPath.value[0], item),
                'sf-menu-row--selected': item.selected && !item.iconKind,
              }"
              @mouseenter="onEnter($event, item, depth)"
              @click="onRowClick(item)"
            >
              <span class="sf-menu-cell sf-menu-cell--icon">
                <Icon v-if="item.icon" :icon="item.icon" />
                <span v-else-if="item.iconKind === 'check'" class="sf-menu-mark"><SvgIcon v-if="item.selected" name="✓" /></span>
                <span v-else-if="item.iconKind === 'dot'" class="sf-menu-mark"><SvgIcon v-if="item.selected" name="●" /></span>
              </span>
              <span class="sf-menu-cell sf-menu-cell--label">{{ item.label }}</span>
              <span v-if="item.detail || item.accelerator" class="sf-menu-cell sf-menu-cell--hint">
                {{ item.detail ?? item.accelerator }}
              </span>
              <span v-if="item.items?.length" class="sf-menu-cell sf-menu-cell--arrow"><SvgIcon name="▶" /></span>
            </div>
          </template>
        </div>
      </div>

      <Menu
        v-if="hasChildItems"
        :items="childItems"
        :box-style="menuState.subPos.value[1]"
        :depth="1"
        :hover-path="menuState.hoverPath"
        :sub-pos="menuState.subPos"
        :hover-item="handleHover"
        embedded
        @select="onEmbeddedSelect"
      />
    </div>
  </template>

  <template v-else>
    <div
      ref="boxEl"
      class="sf-menu-pop"
      :style="[boxStyle, adjustedLeft ? { left: adjustedLeft } : {}]"
    >
      <div class="sf-menu-scroll">
        <template v-for="(item, i) in items" :key="item.id ?? `sep-${i}`">
          <div v-if="item.separator" class="sf-menu-separator" />
          <div
            v-else
            class="sf-menu-row"
            :class="{
              'sf-menu-row--disabled': item.disabled,
              'sf-menu-row--open': sameMenu(hoverPath.value[depth], item),
              'sf-menu-row--selected': item.selected && !item.iconKind,
            }"
            @mouseenter="onEnter($event, item, depth)"
            @click="onRowClick(item)"
          >
            <span class="sf-menu-cell sf-menu-cell--icon">
              <Icon v-if="item.icon" :icon="item.icon" />
              <span v-else-if="item.iconKind === 'check'" class="sf-menu-mark"><SvgIcon v-if="item.selected" name="✓" /></span>
              <span v-else-if="item.iconKind === 'dot'" class="sf-menu-mark"><SvgIcon v-if="item.selected" name="●" /></span>
            </span>
            <span class="sf-menu-cell sf-menu-cell--label">{{ item.label }}</span>
            <span v-if="item.detail || item.accelerator" class="sf-menu-cell sf-menu-cell--hint">
              {{ item.detail ?? item.accelerator }}
            </span>
            <span v-if="item.items?.length" class="sf-menu-cell sf-menu-cell--arrow"><SvgIcon name="▶" /></span>
          </div>
        </template>
      </div>
    </div>

    <Menu
      v-if="hasChildItems"
      :items="childItems"
      :box-style="subPos.value[depth + 1]"
      :depth="depth + 1"
      :hover-path="hoverPath"
      :sub-pos="subPos"
      :hover-item="hoverItem"
      embedded
      @select="onEmbeddedSelect"
    />
  </template>
</template>
