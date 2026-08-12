<script setup lang="ts">
import { computed } from 'vue';

/**
 * Inline SVG icons — every glyph is drawn as vector paths so it renders
 * identically on every platform (no font-dependent Unicode characters).
 * Stroke style: 24x24 viewBox, 1.8px round strokes, currentColor.
 * Filled entries (color swatches, the chat cursor) use solid currentColor.
 *
 * NOTE: the emoji used by the docker apps (📁 🔍 📄 🐛 🧩 ⚙️ 🗂 💬) are
 * deliberately NOT in this registry — they still render as text via the
 * Icon fallback until the docker set is converted too.
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
