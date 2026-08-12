<script setup lang="ts">
/**
 * Menu — the framework's unified multi-level flyout menu.
 *
 * One item renders as  [ icon | label | hint | arrow ]:
 *   - icon column is always reserved (fixed width); it shows the item's
 *     icon, or a selection mark — ✓ for multi-select (iconKind 'check'),
 *     ● for single-select (iconKind 'dot') — or stays empty.
 *   - hint (detail/accelerator) is right-aligned before the arrow.
 *   - arrow indicates a submenu; submenus open on hover.
 *   - a `separator` item draws a segregation line.
 *
 * Mechanics: the popup and every submenu are position:fixed boxes (theme
 * shape: rounded corners, border, shadow — same as every framework box),
 * computed from trigger/item rects and flipping LEFT when there is no room
 * on the right, so no ancestor overflow can clip them. The whole flyout
 * lives in one region. A click-opened menu stays open until a leaf is
 * selected, the user clicks away, or Escape is pressed — moving the mouse
 * away never closes it (same behavior as the menu bar's menus).
 *
 * The component is recursive: each level renders its own box plus the next
 * level as a fixed-positioned sibling. Root mode owns the anchor + trigger
 * slot + open wiring; deeper levels run in `embedded` mode (box only) and
 * share the hover state through props (root-owned refs passed down).
 */
import { computed, nextTick, onMounted, type Ref, ref, watch } from 'vue';
import type { MenuNodeDef } from '../types/layout';
import Icon from './Icon.vue';
import SvgIcon from './SvgIcon.vue';

const props = withDefaults(
  defineProps<{
    items: MenuNodeDef[];
    /** Controlled open state (root only). */
    open?: boolean;
    /** Close after a leaf select (root only). */
    closeOnSelect?: boolean;
    /** Embedded (deeper) level: renders only its box, positioned by boxStyle. */
    embedded?: boolean;
    /** Depth of this level (root = 0). */
    depth?: number;
    /** Fixed position for this level's box (embedded only). */
    boxStyle?: { left: string; top: string; parentLeft?: number };
    /** Shared hover path (root-owned ref, passed down). */
    hoverPath?: Ref<MenuNodeDef[]>;
    /** Shared submenu positions per depth (root-owned ref, passed down). */
    subPos?: Ref<Record<number, { left: string; top: string; parentLeft?: number }>>;
    /** Root's hover handler (passed down to embedded levels). */
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

// ── Shared flyout state ───────────────────────────────────────────────────
// The root owns the hover path + submenu positions and passes them down as
// props (Refs) so every recursive level shares one reactive state.

const rootHoverPath = ref<MenuNodeDef[]>([]);
const rootSubPos = ref<Record<number, { left: string; top: string; parentLeft?: number }>>({});
// Nested in an object so template bindings pass the REF (not the unwrapped
// value) down to recursive levels.
const menuState = { hoverPath: rootHoverPath, subPos: rootSubPos };

/** Position a submenu box from the hovered item's rect (flip left when tight). */
function positionFor(rect: DOMRect): { left: string; top: string; parentLeft: number } {
  const W = 224;
  let left = rect.right + 2;
  if (left + W > window.innerWidth - 4) left = rect.left - W - 2;
  // Mobile: a flip can still land off-screen LEFT when the menu sits at
  // the screen edge — clamp so the submenu stays reachable (it overlaps
  // the parent, the standard hamburger-menu pattern).
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
    // Hovering a leaf closes any deeper open submenus.
    rootHoverPath.value.splice(depth);
    delete rootSubPos.value[depth + 1];
  }
}

/** This level's open child submenu items (next level); empty when closed. */
const childItems = computed<MenuNodeDef[]>(() => {
  const path = props.embedded ? props.hoverPath?.value : rootHoverPath.value;
  const node = path?.[props.depth];
  return node?.items?.length ? node.items : [];
});
const hasChildItems = computed(() => childItems.value.length > 0);

// ── Root-only state & wiring ───────────────────────────────────────────────

const anchorEl = ref<HTMLElement | null>(null);
const popEl = ref<HTMLElement | null>(null);
const regionEl = ref<HTMLElement | null>(null);
const popStyle = ref({ left: '0px', top: '0px' });

function close() {
  emit('update:open', false);
}

async function positionPopup() {
  // The open prop flips before the popup mounts — wait for the render first.
  await nextTick();
  const anchor = anchorEl.value;
  const pop = popEl.value;
  if (!anchor || !pop) return;
  // The anchor span is display:contents (no box of its own) — measure the
  // trigger element the parent rendered inside the slot.
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
      void positionPopup();
    }
  },
);

/**
 * Embedded levels: after the box mounts (or its position prop changes),
 * measure the REAL width — it can exceed the flip estimate (long labels)
 * and overlap the parent box — and pull it fully left of the parent item.
 */
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
  // Only correct boxes that could actually overlap something:
  //  - flipped LEFT of the parent (left < parentLeft): must not cover the
  //    parent item — the flip estimate (224px) can be smaller than the real
  //    width, so pull fully left of the item.
  //  - right of the parent but the real width overflows the viewport: pull
  //    fully left of the parent instead.
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
  if (item.items?.length) return; // submenu parents open on hover only
  if (props.closeOnSelect && !props.embedded) close();
  emit('select', item);
}

/** Root closes on any leaf select from a deeper level too. */
function onEmbeddedSelect(item: MenuNodeDef) {
  if (props.closeOnSelect) close();
  emit('select', item);
}

function onDocDown(e: MouseEvent) {
  if (!props.open) return;
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
}
</script>

<template>
  <!-- Root: anchor (display:contents) + trigger slot + one region holding
       every level's box as fixed-positioned siblings (no clipping). -->
  <template v-if="!embedded">
    <span ref="anchorEl" class="sf-menu-anchor">
      <slot name="trigger" :toggle="() => emit('update:open', !open)" :open="open" />
    </span>

    <div v-if="open" ref="regionEl" class="sf-menu-region">
      <div ref="popEl" class="sf-menu-pop" :style="popStyle">
        <div class="sf-menu-scroll">
          <template v-for="(item, i) in items" :key="item.id ?? `sep-${i}`">
            <div v-if="item.separator" class="sf-menu-separator" />
            <div
              v-else
              class="sf-menu-row"
              :class="{
                'sf-menu-row--disabled': item.disabled,
                'sf-menu-row--open': menuState.hoverPath.value[0] === item,
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

      <!-- Next level (fixed sibling box) -->
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

  <!-- Embedded level: its box plus the next level, as siblings. -->
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
              'sf-menu-row--open': hoverPath.value[depth] === item,
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
