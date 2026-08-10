<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Menu from './Menu.vue';
import type { MenuNodeDef } from '../types/layout';

// ── Keyboard accelerators ─────────────────────────────────────────────────
// Menu items can declare `accelerator` in the layout JSON ("Ctrl+N",
// "Ctrl+K Ctrl+O", ...). A window-level keydown listener matches them and
// dispatches the same menu action as a click would. Two-part accelerators
// (chords like "Ctrl+K Ctrl+O") arm on the first key and complete on the
// second within a short window.

interface AccelKey {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

interface AccelBinding {
  /** 1 = plain shortcut, 2 = chord */
  chord: AccelKey[];
  action: string;
}

/** Normalize a key name from either an accelerator spec or a KeyboardEvent. */
function normKey(k: string): string {
  let s = k.trim().toLowerCase();
  if (s === 'space') return ' ';
  if (s === 'esc') return 'escape';
  if (s === 'return') return 'enter';
  if (s === 'del') return 'delete';
  if (s === 'up') return 'arrowup';
  if (s === 'down') return 'arrowdown';
  if (s === 'left') return 'arrowleft';
  if (s === 'right') return 'arrowright';
  return s;
}

/** Parse one accelerator string into its key parts (chords separated by space). */
function parseAccel(spec: string): AccelKey[] | null {
  const chord: AccelKey[] = [];
  for (const part of spec.trim().split(/\s+/)) {
    if (!part) continue;
    const tokens = part.split('+');
    const key = normKey(tokens.pop() ?? '');
    if (!key) return null;
    const acc: AccelKey = { key, ctrl: false, shift: false, alt: false, meta: false };
    for (const t of tokens) {
      const m = t.trim().toLowerCase();
      if (m === 'ctrl' || m === 'control') acc.ctrl = true;
      else if (m === 'shift') acc.shift = true;
      else if (m === 'alt' || m === 'option') acc.alt = true;
      else if (m === 'meta' || m === 'cmd' || m === 'command') acc.meta = true;
      else return null;
    }
    chord.push(acc);
  }
  return chord.length > 0 ? chord : null;
}

function keyOf(e: KeyboardEvent): string {
  return normKey(e.key);
}

/** Exact match: every modifier must be pressed exactly as declared. */
function matches(e: KeyboardEvent, acc: AccelKey): boolean {
  return (
    !!e.ctrlKey === acc.ctrl &&
    !!e.shiftKey === acc.shift &&
    !!e.altKey === acc.alt &&
    !!e.metaKey === acc.meta &&
    keyOf(e) === acc.key
  );
}

/** Flat list of (accelerator → action) from the menu tree (leaf items only). */
function collectBindings(menus: MenuNodeDef[], acc: AccelBinding[] = []): AccelBinding[] {
  for (const m of menus) {
    if (m.items) collectBindings(m.items, acc);
    else if (m.action && m.accelerator) {
      const chord = parseAccel(m.accelerator);
      if (chord) acc.push({ chord, action: m.action });
    }
  }
  return acc;
}

let bindings: AccelBinding[] = [];
let armed: AccelBinding | null = null;
let armTimer: number | null = null;

function onKeyDown(e: KeyboardEvent) {
  if (e.repeat) return;
  // Modifier-only keys (releasing Ctrl after a chord) never match.
  const k = keyOf(e);
  if (k === 'control' || k === 'shift' || k === 'alt' || k === 'meta') return;

  // An armed chord only completes on its second key; anything else cancels
  // it and is then tested as a fresh shortcut below.
  if (armed) {
    if (matches(e, armed.chord[1])) {
      e.preventDefault();
      const action = armed.action;
      armed = null;
      if (armTimer !== null) { window.clearTimeout(armTimer); armTimer = null; }
      emit('menu-action', action);
      return;
    }
    armed = null;
    if (armTimer !== null) { window.clearTimeout(armTimer); armTimer = null; }
  }

  for (const b of bindings) {
    if (!matches(e, b.chord[0])) continue;
    e.preventDefault();
    if (b.chord.length === 1) {
      emit('menu-action', b.action);
      return;
    }
    // Chord: arm the second key for a short window.
    armed = b;
    if (armTimer !== null) window.clearTimeout(armTimer);
    armTimer = window.setTimeout(() => { armed = null; armTimer = null; }, 2000);
    return;
  }
}

onMounted(() => {
  bindings = collectBindings(props.menus);
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  if (armTimer !== null) window.clearTimeout(armTimer);
});

const props = defineProps<{
  menus: MenuNodeDef[];
  leftPanelVisible?: boolean;
}>();

const emit = defineEmits<{
  'toggle-left-panel': [];
  'menu-action': [actionId: string];
}>();

const openMenu = ref<string | null>(null);

function setOpen(label: string | undefined, open: boolean) {
  openMenu.value = open && label ? label : null;
}

function onMenuHover(label?: string) {
  if (!label || !openMenu.value) return;
  openMenu.value = label;
}

function onItemAction(item: MenuNodeDef) {
  openMenu.value = null;
  if (item.action) emit('menu-action', item.action);
}
</script>

<template>
  <div class="sf-menu-bar">
    <div class="sf-menu-actions sf-menu-actions--left">
      <button
        class="sf-menu-action-btn"
        :title="props.leftPanelVisible ? 'Collapse Left Panel' : 'Expand Left Panel'"
        @click="emit('toggle-left-panel')"
      >
        {{ props.leftPanelVisible ? '\u25EB' : '\u25A1' }}
      </button>
    </div>

    <div class="sf-menu-items">
      <Menu
        v-for="menu in menus"
        :key="menu.id"
        :items="menu.items ?? []"
        :open="openMenu === menu.label"
        @update:open="(v) => setOpen(menu.label, v)"
        @select="onItemAction"
      >
        <template #trigger="{ toggle, open }">
          <div
            class="sf-menu-item"
            :class="{ 'sf-menu-item--open': open }"
            @click="toggle"
            @mouseenter="onMenuHover(menu.label)"
          >
            {{ menu.label }}
          </div>
        </template>
      </Menu>
    </div>
  </div>
</template>
