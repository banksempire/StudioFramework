<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { hsvToRgb, parseHex, rgbToHsv, toColorHex } from '../utils/color';

const props = withDefaults(
  defineProps<{
    color?: string;
  }>(),
  { color: '' },
);

const emit = defineEmits<(e: 'update', value: string) => void>();

const h = ref(180);
const s = ref(0.65);
const v = ref(0.65);
const a = ref(1);

function apply(nh: number, ns: number, nv: number, na: number) {
  h.value = ((nh % 360) + 360) % 360;
  s.value = Math.min(1, Math.max(0, ns));
  v.value = Math.min(1, Math.max(0, nv));
  a.value = Math.min(1, Math.max(0, na));
  emit('update', toColorHex(rgb.value, a.value));
}

const rgb = computed(() => hsvToRgb({ h: h.value, s: s.value, v: v.value }));
const hexText = computed(() => toColorHex(rgb.value, a.value).toUpperCase());

function adopt(hex: string) {
  const parsed = parseHex(hex);
  if (!parsed) return false;
  const hsv = rgbToHsv(parsed);
  if (hsv.s > 0) h.value = hsv.h;
  s.value = hsv.s;
  v.value = hsv.v;
  a.value = parsed.a;
  return true;
}

watch(
  () => props.color,
  (c) => {
    if (c && toColorHex(rgb.value, a.value) !== c.toLowerCase()) adopt(c);
  },
  { immediate: true },
);

const discEl = ref<HTMLElement | null>(null);
const valEl = ref<HTMLElement | null>(null);
const alphaEl = ref<HTMLElement | null>(null);
type DragZone = 'disc' | 'val' | 'alpha';
const drag = ref<DragZone | null>(null);

function startDrag(zone: DragZone, e: PointerEvent) {
  drag.value = zone;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  moveDrag(e);
}

function moveDrag(e: PointerEvent) {
  if (!drag.value) return;
  if (drag.value === 'disc' && discEl.value) {
    const rect = discEl.value.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const radius = rect.width / 2;
    const dist = Math.min(radius, Math.hypot(dx, dy));
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    apply(deg, dist / radius, v.value, a.value);
  } else if (drag.value === 'val' && valEl.value) {
    const rect = valEl.value.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    apply(h.value, s.value, frac, a.value);
  } else if (drag.value === 'alpha' && alphaEl.value) {
    const rect = alphaEl.value.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    apply(h.value, s.value, v.value, frac);
  }
}

function endDrag() {
  drag.value = null;
}

const hueHex = computed(() => toColorHex(hsvToRgb({ h: h.value, s: 1, v: 1 }), 1));

const dotStyle = computed(() => ({
  left: `${50 + s.value * 50 * Math.sin((h.value * Math.PI) / 180)}%`,
  top: `${50 - s.value * 50 * Math.cos((h.value * Math.PI) / 180)}%`,
  background: hexText.value,
}));

const valDotStyle = computed(() => ({ left: `${v.value * 100}%`, background: hexText.value }));
const alphaDotStyle = computed(() => ({ left: `${a.value * 100}%`, background: hexText.value }));
const valTrack = computed(() => ({
  background: `linear-gradient(to right, #000000, ${hueHex.value})`,
}));

function onHex(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!adopt(input.value.trim())) input.value = hexText.value;
  else emit('update', toColorHex(rgb.value, a.value));
}

function onChannel(channel: 'r' | 'g' | 'b', e: Event) {
  const input = e.target as HTMLInputElement;
  const n = Math.round(Math.min(255, Math.max(0, Number(input.value) || 0)));
  input.value = String(n);
  const next = { ...rgb.value, [channel]: n };
  const hsv = rgbToHsv(next);
  apply(hsv.s > 0 ? hsv.h : h.value, hsv.s, hsv.v, a.value);
}

const alphaPct = computed(() => Math.round(a.value * 100));

function onAlphaPct(e: Event) {
  const input = e.target as HTMLInputElement;
  const n = Math.round(Math.min(100, Math.max(0, Number(input.value) || 0)));
  input.value = String(n);
  apply(h.value, s.value, v.value, n / 100);
}

interface SchemeVariant {
  h: number;
  s: number;
  v: number;
}

const SCHEMES: Array<{
  id: string;
  label: string;
  variants: (base: { h: number; s: number; v: number }) => SchemeVariant[];
}> = [
  {
    id: 'complementary',
    label: 'Complementary',
    variants: (b) => [b, { ...b, h: b.h + 180 }],
  },
  {
    id: 'split',
    label: 'Split',
    variants: (b) => [b, { ...b, h: b.h + 150 }, { ...b, h: b.h + 210 }],
  },
  {
    id: 'monochromatic',
    label: 'Monochromatic',
    variants: (b) => [
      b,
      { h: b.h, s: b.s * 0.45, v: Math.min(1, b.v * 1.15) },
      { h: b.h, s: Math.min(1, b.s * 1.1), v: b.v * 0.55 },
    ],
  },
  {
    id: 'analogous',
    label: 'Analogous',
    variants: (b) => [{ ...b, h: b.h + 330 }, b, { ...b, h: b.h + 30 }],
  },
  {
    id: 'triadic',
    label: 'Triadic',
    variants: (b) => [b, { ...b, h: b.h + 120 }, { ...b, h: b.h + 240 }],
  },
  {
    id: 'square',
    label: 'Square',
    variants: (b) => [b, { ...b, h: b.h + 90 }, { ...b, h: b.h + 180 }, { ...b, h: b.h + 270 }],
  },
];

const schemeId = ref('complementary');
const schemeOpen = ref(false);
const schemeRoot = ref<HTMLElement | null>(null);

const scheme = computed(() => SCHEMES.find((x) => x.id === schemeId.value) ?? SCHEMES[0]);
const schemeLabel = computed(() => scheme.value.label);

const schemeColors = computed(() =>
  scheme.value.variants({ h: h.value, s: s.value, v: v.value }).map((x) => ({
    ...x,
    hex: toColorHex(
      hsvToRgb({
        h: ((x.h % 360) + 360) % 360,
        s: Math.min(1, Math.max(0, x.s)),
        v: Math.min(1, Math.max(0, x.v)),
      }),
      1,
    ),
  })),
);

function toggleScheme() {
  schemeOpen.value = !schemeOpen.value;
}

function pickScheme(id: string) {
  schemeId.value = id;
  schemeOpen.value = false;
}

function pickVariant(x: { h: number; s: number; v: number }) {
  apply(x.h, x.s, x.v, a.value);
}

function onSchemePointer(e: PointerEvent) {
  if (schemeRoot.value && !schemeRoot.value.contains(e.target as Node)) schemeOpen.value = false;
}

watch(schemeOpen, (open) => {
  if (open) document.addEventListener('pointerdown', onSchemePointer, true);
  else document.removeEventListener('pointerdown', onSchemePointer, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onSchemePointer, true);
});
</script>

<template>
  <div class="sf-color-wheel">
    <div
      ref="discEl"
      class="sf-color-wheel-disc"
      @pointerdown="startDrag('disc', $event)"
      @pointermove="moveDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <div class="sf-color-wheel-dot" :style="dotStyle" />
    </div>
    <div class="sf-color-wheel-bars">
      <div
        ref="valEl"
        class="sf-color-wheel-bar"
        :style="valTrack"
        @pointerdown="startDrag('val', $event)"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <div class="sf-color-wheel-dot" :style="valDotStyle" />
      </div>
      <div
        ref="alphaEl"
        class="sf-color-wheel-bar sf-color-wheel-bar--alpha"
        :style="{ '--sf-color-wheel-hue': hueHex }"
        @pointerdown="startDrag('alpha', $event)"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <div class="sf-color-wheel-dot" :style="alphaDotStyle" />
      </div>
    </div>
    <div class="sf-color-wheel-inputs">
      <label class="sf-color-wheel-field sf-color-wheel-field--hex">
        <span>HEX</span>
        <input class="sf-color-wheel-input sf-color-wheel-input--hex" :value="hexText" spellcheck="false" @change="onHex" />
      </label>
      <label class="sf-color-wheel-field">
        <span>R</span>
        <input class="sf-color-wheel-input" type="number" min="0" max="255" :value="rgb.r" @input="onChannel('r', $event)" />
      </label>
      <label class="sf-color-wheel-field">
        <span>G</span>
        <input class="sf-color-wheel-input" type="number" min="0" max="255" :value="rgb.g" @input="onChannel('g', $event)" />
      </label>
      <label class="sf-color-wheel-field">
        <span>B</span>
        <input class="sf-color-wheel-input" type="number" min="0" max="255" :value="rgb.b" @input="onChannel('b', $event)" />
      </label>
      <label class="sf-color-wheel-field">
        <span>A %</span>
        <input class="sf-color-wheel-input" type="number" min="0" max="100" :value="alphaPct" @input="onAlphaPct($event)" />
      </label>
    </div>
    <div ref="schemeRoot" class="sf-color-schemes">
      <button type="button" class="sf-color-schemes-btn" @click="toggleScheme">
        <span>{{ schemeLabel }}</span>
        <span class="sf-color-schemes-caret">▾</span>
      </button>
      <div v-if="schemeOpen" class="sf-color-schemes-pop">
        <button
          v-for="x in SCHEMES"
          :key="x.id"
          type="button"
          class="sf-color-schemes-item"
          :class="{ 'sf-color-schemes-item--on': x.id === schemeId }"
          @click="pickScheme(x.id)"
        >
          {{ x.label }}
        </button>
      </div>
    </div>
    <div class="sf-color-scheme-chips">
      <button
        v-for="(x, i) in schemeColors"
        :key="i"
        type="button"
        class="sf-color-scheme-chip"
        :class="{ 'sf-color-scheme-chip--base': i === 0 }"
        :style="{ background: x.hex }"
        :title="x.hex"
        @click="pickVariant(x)"
      />
    </div>
  </div>
</template>

<style scoped>
.sf-color-wheel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 208px;
  padding: 10px;
}

.sf-color-wheel-disc {
  position: relative;
  width: 188px;
  height: 188px;
  margin: 0 auto;
  border-radius: 50%;
  background:
    radial-gradient(circle closest-side, #ffffff 0%, rgba(255, 255, 255, 0) 100%),
    conic-gradient(
      from 0deg,
      #ff0000,
      #ff8000,
      #ffff00,
      #80ff00,
      #00ff00,
      #00ff80,
      #00ffff,
      #0080ff,
      #0000ff,
      #8000ff,
      #ff00ff,
      #ff0080,
      #ff0000
    );
  touch-action: none;
  cursor: crosshair;
}

.sf-color-wheel-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sf-color-wheel-bar {
  position: relative;
  height: 14px;
  border-radius: 7px;
  touch-action: none;
  cursor: pointer;
}

.sf-color-wheel-bar--alpha {
  background-image: linear-gradient(to right, transparent, var(--sf-color-wheel-hue)),
    repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%);
  background-size:
    100% 100%,
    12px 12px;
}

.sf-color-wheel-dot {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.sf-color-wheel-inputs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 8px;
}

.sf-color-wheel-field {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.sf-color-wheel-field--hex {
  grid-column: span 2;
}

.sf-color-wheel-field > span {
  flex: none;
  min-width: 22px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sf-text-muted, #889);
}

.sf-color-wheel-input {
  width: 100%;
  min-width: 0;
  padding: 3px 6px;
  font: inherit;
  font-size: 12px;
  color: var(--sf-text, #dde);
  background: var(--sf-bg-input, #1b1b22);
  border: 1px solid var(--sf-border, #333);
  border-radius: 4px;
}

.sf-color-wheel-input--hex {
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
}

.sf-color-wheel-input::-webkit-outer-spin-button,
.sf-color-wheel-input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.sf-color-schemes {
  position: relative;
}

.sf-color-schemes-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 8px;
  font: inherit;
  font-size: 11px;
  color: var(--sf-text, #dde);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--sf-bg-input, #1b1b22);
  border: 1px solid var(--sf-border, #333);
  border-radius: 4px;
  cursor: pointer;
}

.sf-color-schemes-btn:hover {
  border-color: var(--sf-accent, #4499ff);
}

.sf-color-schemes-caret {
  color: var(--sf-text-muted, #889);
}

.sf-color-schemes-pop {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 5;
  background: var(--sf-bg, #16161c);
  border: 1px solid var(--sf-border, #333);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.sf-color-schemes-item {
  display: block;
  width: 100%;
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  text-align: left;
  color: var(--sf-text, #dde);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.sf-color-schemes-item:hover {
  background: var(--sf-hover-overlay, rgba(255, 255, 255, 0.06));
}

.sf-color-schemes-item--on {
  color: var(--sf-accent, #4499ff);
}

.sf-color-scheme-chips {
  display: flex;
  gap: 6px;
}

.sf-color-scheme-chip {
  flex: 1;
  height: 22px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.sf-color-scheme-chip:hover {
  border-color: #ffffff;
}

.sf-color-scheme-chip--base {
  outline: 1px solid rgba(255, 255, 255, 0.7);
  outline-offset: 1px;
}
</style>
