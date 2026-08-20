import { reactive, ref } from 'vue';

export interface SwipeRevealOptions {
  revealWidth: () => number;
  commitTravel?: number;
  onCommit?: (key: string) => void;
}

interface SwipeState {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  active: boolean;
  revealed: boolean;
}

const LOCK_THRESHOLD = 6;
const LAYER_EPSILON = 4;
const COMMIT_FRACTION = 0.55;

export function useSwipeReveal({ revealWidth, commitTravel = 64, onCommit }: SwipeRevealOptions) {
  const rows = reactive<Record<string, SwipeState>>({});
  const suppressedClick = ref<string | null>(null);

  function stateOf(key: string): SwipeState {
    if (!rows[key]) rows[key] = { startX: 0, startY: 0, dx: 0, dy: 0, active: false, revealed: false };
    return rows[key];
  }

  function clamp(v: number): number {
    return Math.max(-(revealWidth() + commitTravel), Math.min(0, v));
  }

  function commitAt(): number {
    return revealWidth() + commitTravel * COMMIT_FRACTION;
  }

  function offset(key: string): number {
    const s = rows[key];
    if (!s) return 0;
    if (s.active) return clamp((s.revealed ? -revealWidth() : 0) + s.dx);
    return s.revealed ? -revealWidth() : 0;
  }

  function styleOf(key: string) {
    const s = rows[key];
    if (!s || (!s.active && !s.revealed)) return undefined;
    return { transform: `translate3d(${offset(key)}px, 0, 0)` };
  }

  function underWidth(key: string): number {
    return Math.max(revealWidth(), -offset(key));
  }

  function isSwiping(key: string): boolean {
    return rows[key]?.active ?? false;
  }

  function isRevealed(key: string): boolean {
    return rows[key]?.revealed ?? false;
  }

  function isLayerVisible(key: string): boolean {
    const s = rows[key];
    if (!s) return false;
    if (s.revealed) return true;
    return s.active && offset(key) < -LAYER_EPSILON;
  }

  function isArmed(key: string): boolean {
    const s = rows[key];
    return !!s?.active && offset(key) <= -commitAt();
  }

  function begin(key: string, e: PointerEvent) {
    const s = stateOf(key);
    if (suppressedClick.value === key) suppressedClick.value = null;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.dx = 0;
    s.dy = 0;
    s.active = false;
  }

  function move(e: PointerEvent, key: string) {
    const s = rows[key];
    if (!s) return;
    s.dx = e.clientX - s.startX;
    s.dy = e.clientY - s.startY;
    if (!s.active) {
      if (Math.abs(s.dx) < LOCK_THRESHOLD || Math.abs(s.dx) < Math.abs(s.dy)) return;
      s.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      for (const k of Object.keys(rows)) {
        if (k !== key) rows[k].revealed = false;
      }
    }
  }

  function touchMove(e: TouchEvent, key: string) {
    if (rows[key]?.active) e.preventDefault();
  }

  function end(key: string) {
    const s = rows[key];
    if (!s) return;
    if (s.active) {
      const base = s.revealed ? -revealWidth() : 0;
      const cur = clamp(base + s.dx);
      suppressedClick.value = key;
      if (cur <= -commitAt()) {
        s.revealed = false;
        onCommit?.(key);
      } else {
        s.revealed = cur < -revealWidth() / 2;
      }
    }
    s.active = false;
  }

  function hide(key: string) {
    const s = rows[key];
    if (s) s.revealed = false;
  }

  function consumeClick(key: string): boolean {
    if (suppressedClick.value !== key) return false;
    suppressedClick.value = null;
    return true;
  }

  function dropMissing(keys: Set<string>) {
    for (const k of Object.keys(rows)) {
      if (!keys.has(k)) delete rows[k];
    }
    if (suppressedClick.value && !keys.has(suppressedClick.value)) suppressedClick.value = null;
  }

  function reset() {
    for (const k of Object.keys(rows)) {
      rows[k].active = false;
      rows[k].revealed = false;
      rows[k].dx = 0;
    }
    suppressedClick.value = null;
  }

  return {
    rows,
    suppressedClick,
    offset,
    styleOf,
    underWidth,
    isSwiping,
    isRevealed,
    isLayerVisible,
    isArmed,
    begin,
    move,
    touchMove,
    end,
    hide,
    consumeClick,
    dropMissing,
    reset,
  };
}
