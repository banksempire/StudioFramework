<script setup lang="ts">
import { computed } from 'vue';

/**
 * Inline SVG icons — every glyph is drawn as vector paths so it renders
 * identically on every platform (no font-dependent Unicode characters).
 * Stroke style: 24x24 viewBox, 1.8px round strokes, currentColor.
 * Filled entries (color swatches, the chat cursor) use solid currentColor.
 *
 * The docker app emoji (📁 🔍 📄 🐛 🧩 ⚙️ 🗂 💬) are registered here as
 * vector glyphs too — the dock renders pure SVG everywhere.
 */
interface IconSpec {
  paths: Array<{ d: string; filled?: boolean }>;
}

const ICONS: Record<string, IconSpec> = {
  // ── Layout/status-bar glyphs ──────────────────────────────────────────
  '↻': {
    // refresh-cw
    paths: [
      { d: 'M23 4v6h-6' },
      { d: 'M1 20v-6h6' },
      { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10' },
      { d: 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15' },
    ],
  },
  '⚠': {
    // alert-triangle
    paths: [
      { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' },
      { d: 'M12 9v4' },
      { d: 'M12 17h.01' },
    ],
  },
  '⚡': {
    // zap
    paths: [{ d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' }],
  },
  '✕': {
    // x
    paths: [{ d: 'M18 6L6 18' }, { d: 'M6 6l12 12' }],
  },
  '⤢': {
    // expand diagonal
    paths: [{ d: 'M15 3h6v6' }, { d: 'M9 21H3v-6' }, { d: 'M21 3l-7 7' }, { d: 'M3 21l7-7' }],
  },
  '🎨': {
    // palette: circle outline + three color dots
    paths: [
      { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' },
      { d: 'M7.6 9.6m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0', filled: true },
      { d: 'M12 7.2m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0', filled: true },
      { d: 'M16.4 9.6m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0', filled: true },
    ],
  },
  '☰': {
    // menu
    paths: [{ d: 'M3 12h18' }, { d: 'M3 6h18' }, { d: 'M3 18h18' }],
  },
  '➕': {
    // plus
    paths: [{ d: 'M12 5v14' }, { d: 'M5 12h14' }],
  },
  '🟨': {
    // yellow square swatch
    paths: [{ d: 'M4 4h16v16H4z', filled: true }],
  },
  '🟦': {
    // blue square swatch
    paths: [{ d: 'M4 4h16v16H4z', filled: true }],
  },
  '🟩': {
    // green square swatch
    paths: [{ d: 'M4 4h16v16H4z', filled: true }],
  },
  '🟢': {
    // green circle swatch
    paths: [{ d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', filled: true }],
  },

  // ── Title-bar / menu chrome ───────────────────────────────────────────
  '⋯': {
    // more-horizontal: three dots
    paths: [
      { d: 'M5 12m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0', filled: true },
      { d: 'M12 12m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0', filled: true },
      { d: 'M19 12m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0', filled: true },
    ],
  },
  '▶': {
    // play
    paths: [{ d: 'M6 4l14 8-14 8z' }],
  },
  '❯': {
    // chevron-right
    paths: [{ d: 'M9 18l6-6-6-6' }],
  },
  '⇔': {
    // evenly-space: three equal bars
    paths: [{ d: 'M18 20V10' }, { d: 'M12 20V4' }, { d: 'M6 20v-6' }],
  },
  '□': {
    // merge all: maximize corners
    paths: [
      { d: 'M8 3H5a2 2 0 0 0-2 2v3' },
      { d: 'M21 8V5a2 2 0 0 0-2-2h-3' },
      { d: 'M3 16v3a2 2 0 0 0 2 2h3' },
      { d: 'M16 21h3a2 2 0 0 0 2-2v-3' },
    ],
  },
  '✎': {
    // edit
    paths: [{ d: 'M12 20h9' }, { d: 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' }],
  },
  '↑': {
    // arrow-up
    paths: [{ d: 'M12 19V5' }, { d: 'M5 12l7-7 7 7' }],
  },
  '↓': {
    // arrow-down
    paths: [{ d: 'M12 5v14' }, { d: 'M19 12l-7 7-7-7' }],
  },
  '←': {
    // arrow-left (mobile menu sheet back button)
    paths: [{ d: 'M19 12H5' }, { d: 'M12 19l-7-7 7-7' }],
  },
  '🗑': {
    // trash
    paths: [
      { d: 'M3 6h18' },
      { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
      { d: 'M3 6V4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2' },
      { d: 'M10 11v6' },
      { d: 'M14 11v6' },
    ],
  },
  // Panel toggles: half-filled squares (left half = panel open, right half
  // = closed) — replaces the font-dependent ◨/◫ glyphs.
  '\u25E8': {
    paths: [{ d: 'M4 4h16v16H4z' }, { d: 'M12 4h8v16h-8z', filled: true }],
  },
  '\u25EB': {
    paths: [{ d: 'M4 4h16v16H4z' }, { d: 'M4 4h8v16H4z', filled: true }],
  },
  // Chat streaming cursor: a solid block bar.
  '▌': {
    paths: [{ d: 'M9 4h2v16H9z', filled: true }],
  },
  '✓': {
    // check (menu multi-select mark, tree checkbox)
    paths: [{ d: 'M20 6L9 17l-5-5' }],
  },
  '●': {
    // filled dot (menu single-select mark)
    paths: [{ d: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0', filled: true }],
  },
  '–': {
    // dash (tree checkbox mid state)
    paths: [{ d: 'M7 12h10' }],
  },
  '▸': {
    // chevron-right (tree/group expanders)
    paths: [{ d: 'M9 18l6-6-6-6' }],
  },
  '▾': {
    // chevron-down (group expanders, open state)
    paths: [{ d: 'M6 9l6 6 6-6' }],
  },
  '⏳': {
    // hourglass (running session indicator)
    paths: [
      { d: 'M6 3h12' },
      { d: 'M6 21h12' },
      { d: 'M7 3v2a5 5 0 0 0 10 0V3' },
      { d: 'M7 21v-2a5 5 0 0 1 10 0v2' },
    ],
  },

  // ── Docker app icons ──────────────────────────────────────────────────
  '📁': {
    // folder (Explorer)
    paths: [{ d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z' }],
  },
  '🔍': {
    // search / magnifier
    paths: [{ d: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z' }, { d: 'M21 21l-4.35-4.35' }],
  },
  '📄': {
    // file / document (Source Control)
    paths: [{ d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }, { d: 'M14 2v6h6' }],
  },
  '🐛': {
    // bug (Debug)
    paths: [
      { d: 'M8 2l1.88 1.88' },
      { d: 'M14.12 3.88L16 2' },
      { d: 'M9 7.13v-1a3.003 3.003 0 1 1 6 0v1' },
      { d: 'M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6' },
      { d: 'M12 20v-9' },
      { d: 'M6.53 9C4.6 8.8 3 7.1 3 5' },
      { d: 'M6 13H2' },
      { d: 'M3 21c0-2.1 1.7-3.9 3.8-4' },
      { d: 'M20.97 5c0 2.1-1.6 3.8-3.5 4' },
      { d: 'M22 13h-4' },
      { d: 'M17.2 17c2.1.1 3.8 1.9 3.8 4' },
    ],
  },
  '🧩': {
    // puzzle piece (Extensions)
    paths: [
      {
        d: 'M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z',
      },
    ],
  },
  '⚙️': {
    // gear / settings
    paths: [
      { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
      {
        d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
      },
    ],
  },
  '🗂': {
    // Windows-style 2×2 grid of four squares (Workspace) — 8×8 squares
    // from x/y 2 to 22 so the glyph fills the viewBox like the other icons
    paths: [{ d: 'M2 2h8v8H2z' }, { d: 'M14 2h8v8h-8z' }, { d: 'M14 14h8v8h-8z' }, { d: 'M2 14h8v8H2z' }],
  },
  '💬': {
    // chat bubble: round-corner box with three dots and a narrow
    // bottom-right tail — fills the viewBox (18 wide box, tail to the
    // 23,23 corner) so it reads the same size as the other dock glyphs
    paths: [
      { d: 'M3 6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8l2 9-7-4H7a4 4 0 0 1-4-4V6z' },
      { d: 'M8 10.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0', filled: true },
      { d: 'M12 10.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0', filled: true },
      { d: 'M16 10.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0', filled: true },
    ],
  },
};

const props = defineProps<{ name: string }>();

const spec = computed(() => ICONS[props.name]);
</script>

<template>
  <svg v-if="spec" class="sf-icon sf-icon--svg" viewBox="0 0 24 24" aria-hidden="true">
    <path
      v-for="(p, i) in spec.paths"
      :key="i"
      :d="p.d"
      :fill="p.filled ? 'currentColor' : 'none'"
      :stroke="p.filled ? 'none' : 'currentColor'"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
  <!-- Unknown glyphs (e.g. the docker emoji, still text until converted)
       fall back to plain text. -->
  <span v-else class="sf-icon">{{ name }}</span>
</template>
