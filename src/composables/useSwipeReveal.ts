import { reactive, ref } from 'vue';

export interface SwipeRevealOptions {
  revealWidth: () => number;
  commitTravel?: number;
  onCommit?: (key: string) => void;
}

interface SwipeState {
  pointerId: number;
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
    if (!rows[key])
      rows[key] = { pointerId: -1, startX: 0, startY: 0, dx: 0, dy: 0, active: false, revealed: false };
    return rows[key];
  }

  function clamp(v: number): number {
    return Math.max(-(revealWidth() + commitTravel), Math.min(0, v));
  }

  function commitOffset(key: string): number {
    const s = rows[key];
    const extra = s?.revealed ? commitTravel : commitTravel * COMMIT_FRACTION;
    return -(revealWidth() + extra);
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
    return !!s?.active && offset(key) <= commitOffset(key);
  }

  function begin(key: string, e: PointerEvent) {
    const s = stateOf(key);
    if (s.pointerId !== -1 && s.pointerId !== e.pointerId) return;
    if (suppressedClick.value === key) suppressedClick.value = null;
    s.pointerId = e.pointerId;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.dx = 0;
    s.dy = 0;
    s.active = false;
  }

  function move(e: PointerEvent, key: string) {
    const s = rows[key];
    if (!s) return;
    if (s.pointerId !== -1 && s.pointerId !== e.pointerId) return;
    if (s.pointerId === -1) {
      s.pointerId = e.pointerId;
      s.startX = e.clientX;
      s.startY = e.clientY;
    }
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

  function end(key: string, e?: PointerEvent) {
    const s = rows[key];
    if (!s) return;
    if (e && s.pointerId !== -1 && e.pointerId !== s.pointerId) return;
    if (s.active) {
      const base = s.revealed ? -revealWidth() : 0;
      const cur = clamp(base + s.dx);
      suppressedClick.value = key;
      if (cur <= commitOffset(key)) {
        s.revealed = false;
        onCommit?.(key);
      } else {
        s.revealed = cur < -revealWidth() / 2;
      }
    }
    s.active = false;
    s.pointerId = -1;
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
      rows[k].pointerId = -1;
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
