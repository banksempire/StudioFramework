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
import {
  computed,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  type Ref,
  reactive,
  ref,
  toRaw,
  watch,
} from 'vue';
import { kIsMobile } from '../composables/useWorkspace';
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
    /** Root sheet title in mobile (defaults to 'menu'). */
    title?: string;
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
  /** Fired when a swiped-open row's action button is tapped (mobile sheet). */
  'swipe-action': [item: MenuNodeDef];
}>();

// ── Mobile fullscreen sheet ───────────────────────────────────────────────
// In mobile mode every menu opens as a fullscreen sheet (like a panel): the
// body takes all the space, the bar has [← back (when nested)] on the left
// and [✕ close] on the right. Parent rows navigate INTO the level on tap
// (no hover on touch); leaves select. Provided by the Framework root.

/** Menu-item equality: ref([]) deep-wraps stored objects in reactive
 *  proxies, so `path[0] === item` compares a proxy against the raw object
 *  and never matches — compare the raw targets instead. */
function sameMenu(a: MenuNodeDef | undefined, b: MenuNodeDef | undefined): boolean {
  return !!a && !!b && toRaw(a) === toRaw(b);
}

const injectedMobile = inject(kIsMobile, null);
const mobile = computed(() => injectedMobile?.value ?? false);

/** Items of the currently shown sheet level (root rows when at the root). */
const sheetItems = computed<MenuNodeDef[]>(() => {
  const top = rootHoverPath.value[rootHoverPath.value.length - 1];
  return top?.items?.length ? top.items : props.items;
});

/** Split the level's items into groups at the separator boundaries — each
 *  maximal run of non-separator items becomes one rounded card (the
 *  separators themselves are dropped; they are the card boundaries). */
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

/** Tap a sheet row: parent rows navigate deeper, leaves select. A real
 *  drag ends with a stray click on the row — suppressed via the key the
 *  swipe handler recorded, so swiping never selects the tab. */
function onSheetRowClick(item: MenuNodeDef, i: number) {
  if (suppressedSwipeKey.value === rowKey(item, i)) {
    suppressedSwipeKey.value = null;
    return;
  }
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

// ── Mobile sheet: swipe a row LEFT to reveal an action (e.g. Close) ──────
// iOS list behavior: opening a row collapses every other revealed row;
// vertical pans stay native (touch-action: pan-y sets scrolling, so a
// swipe only claims the gesture once horizontal intent is clear).

/** Pixels the row body slides left — the full reveal-button width
 *  (86px): the body is full-bleed, so sliding it by the button's own
 *  width exposes the ENTIRE button (its left edge is then flush with the
 *  content's right edge). */
const SWIPE_REVEAL = 86;

interface SwipeState {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  active: boolean;
  revealed: boolean;
}

const swipeRows = reactive<Record<string, SwipeState>>({});
const suppressedSwipeKey = ref<string | null>(null);

function rowKey(item: MenuNodeDef, i: number): string {
  return item.id ?? `item-${i}`;
}

function swipeState(item: MenuNodeDef, i: number): SwipeState {
  const key = rowKey(item, i);
  if (!swipeRows[key]) {
    swipeRows[key] = { startX: 0, startY: 0, dx: 0, dy: 0, active: false, revealed: false };
  }
  return swipeRows[key];
}

function clampSwipe(v: number): number {
  return Math.max(-SWIPE_REVEAL, Math.min(0, v));
}

function onSwipeDown(e: PointerEvent, item: MenuNodeDef, i: number) {
  if (!item.swipeAction) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const s = swipeState(item, i);
  s.startX = e.clientX;
  s.startY = e.clientY;
  s.dx = 0;
  s.dy = 0;
  s.active = false;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}

function onSwipeMove(e: PointerEvent, item: MenuNodeDef, i: number) {
  if (!item.swipeAction) return;
  const s = swipeState(item, i);
  s.dx = e.clientX - s.startX;
  s.dy = e.clientY - s.startY;
  if (!s.active) {
    // Horizontal intent must be clear before claiming the gesture — if
    // the finger moves mostly vertically the browser already owns the
    // scroll (touch-action: pan-y → pointercancel) and we never get here.
    if (Math.abs(s.dx) < 6 || Math.abs(s.dx) < Math.abs(s.dy)) return;
    s.active = true;
    // One revealed row at a time: collapse the others.
    const key = rowKey(item, i);
    for (const k of Object.keys(swipeRows)) {
      if (k !== key) swipeRows[k].revealed = false;
    }
  }
}

function onSwipeEnd(item: MenuNodeDef, i: number) {
  if (!item.swipeAction) return;
  const s = swipeState(item, i);
  if (s.active) {
    const base = s.revealed ? -SWIPE_REVEAL : 0;
    const off = clampSwipe(base + s.dx);
    s.revealed = off < -SWIPE_REVEAL / 2;
    // The pointerup that ends a real drag is followed by a click on the
    // row — suppress it so a swipe never also selects the tab.
    suppressedSwipeKey.value = rowKey(item, i);
  }
  s.active = false;
}

function swipeOffset(item: MenuNodeDef, i: number): number {
  const s = swipeRows[rowKey(item, i)];
  if (!s) return 0;
  if (s.active) {
    const base = s.revealed ? -SWIPE_REVEAL : 0;
    return clampSwipe(base + s.dx);
  }
  return s.revealed ? -SWIPE_REVEAL : 0;
}

function isSwipeActive(item: MenuNodeDef, i: number): boolean {
  return swipeRows[rowKey(item, i)]?.active ?? false;
}

function isSwipeRevealed(item: MenuNodeDef, i: number): boolean {
  return swipeRows[rowKey(item, i)]?.revealed ?? false;
}

/** The button is visible while the row is being dragged open (beyond a
 *  few px) — it is unveiled DURING the swipe, not only after release. */
function isSwipeActionVisible(item: MenuNodeDef, i: number): boolean {
  const s = swipeRows[rowKey(item, i)];
  if (!s) return false;
  if (s.revealed) return true;
  return s.active && swipeOffset(item, i) < -4;
}

/** The revealed action button was tapped: emit up and collapse the row
 *  (in case the consumer does not remove the item, e.g. a guard). */
function onSwipeAction(item: MenuNodeDef) {
  for (const k of Object.keys(swipeRows)) swipeRows[k].revealed = false;
  emit('swipe-action', item);
}

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

// The mobile sheet is TELEPORTED into the framework root and positioned
// absolute, exactly like the .sf-mobile-panel overlays — on iOS, fixed
// elements track the visual viewport (they can sit below the URL bar, so
// the time/signal zone showed a different color than the panels). Anchored
// to the root (position: relative, full-bleed), both overlays cover the
// top safe-area zone identically.
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
      if (!mobile.value) void positionPopup();
    } else {
      rootHoverPath.value.length = 0;
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
  if (!props.open || mobile.value) return; // mobile: the sheet covers the screen; ✕ closes
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
  // Menus unmount (panels switch docker apps, menu bars re-render): drop
  // the window listeners so they can't leak per mount.
  onUnmounted(() => {
    window.removeEventListener('mousedown', onDocDown);
    window.removeEventListener('keydown', onDocKey);
  });
}
</script>

<template>
  <!-- Root: anchor (display:contents) + trigger slot + one region holding
       every level's box as fixed-positioned siblings (no clipping). In
       mobile mode the region is skipped — a fullscreen sheet takes over. -->
  <template v-if="!embedded">
    <span ref="anchorEl" class="sf-menu-anchor">
      <slot name="trigger" :toggle="() => emit('update:open', !open)" :open="open" />
    </span>

    <!-- Mobile fullscreen sheet: body takes all the space; the bar has
         [← back (when nested)] left and [✕ close] right. Tapping a row
         with children navigates into it, leaves select. Teleported to the
         framework root so it anchors like the panel overlays. -->
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
        <!-- One rounded card per group: the runs of items between
             separators (separators become the card boundaries). -->
        <div v-for="(group, gi) in sheetGroups" :key="`group-${gi}`" class="sf-menu-group">
          <div
            v-for="(item, i) in group"
            :key="item.id ?? `item-${i}`"
            class="sf-menu-row"
            :class="{
              'sf-menu-row--disabled': item.disabled,
              'sf-menu-row--selected': item.selected && !item.iconKind,
              'sf-menu-row--swiping': isSwipeActive(item, i),
            }"
            @pointerdown="onSwipeDown($event, item, i)"
            @pointermove="onSwipeMove($event, item, i)"
            @pointerup="onSwipeEnd(item, i)"
            @pointercancel="onSwipeEnd(item, i)"
            @click="onSheetRowClick(item, i)"
          >
            <!-- Swipe-to-reveal action (mobile): pinned to the right
                 edge, hidden until the row body slides left. -->
            <button
              v-if="item.swipeAction"
              class="sf-menu-swipe-action"
              :class="{
                revealed: isSwipeRevealed(item, i),
                active: isSwipeActionVisible(item, i),
              }"
              title="Close"
              @click.stop="onSwipeAction(item)"
            >
              <SvgIcon name="✕" />
              <span>{{ item.swipeAction.label ?? 'Close' }}</span>
            </button>
            <span
              class="sf-menu-row-body"
              :style="
                item.swipeAction
                  ? { transform: `translate3d(${swipeOffset(item, i)}px, 0, 0)` }
                  : undefined
              "
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
            </span>
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
