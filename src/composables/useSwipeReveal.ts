import { reactive, ref } from 'vue';

export interface SwipeRevealOptions {
  revealWidth: () => number;
  rowWidth?: () => number;
  commitStyle?: (key: string) => 'execute' | 'menu';
  onCommit?: (key: string) => void;
}

interface Sample {
  t: number;
  x: number;
}

interface SwipeState {
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  active: boolean;
  revealed: boolean;
  samples: Sample[];
}

interface AnimState {
  x: number;
  v: number;
  target: number;
  stiffness: number;
  damping: number;
  committing: boolean;
  last: number;
  done?: () => void;
}

const LOCK_THRESHOLD = 6;
const LAYER_EPSILON = 4;
const COMMIT_PAST_TRAVEL = 120;
const FLICK_VELOCITY = 1000;
const FLICK_MIN_TRAVEL = 25;
const OPEN_FLICK_VELOCITY = 300;
const SAMPLE_WINDOW = 120;
const SETTLE_STIFFNESS = 400;
const SETTLE_DAMPING = 28;
const COMMIT_STIFFNESS = 1600;
const COMMIT_DAMPING = 60;

export function useSwipeReveal({ revealWidth, rowWidth, commitStyle, onCommit }: SwipeRevealOptions) {
  const rows = reactive<Record<string, SwipeState>>({});
  const anims = reactive<Record<string, AnimState>>({});
  const suppressedClick = ref<string | null>(null);
  let raf = 0;

  function stateOf(key: string): SwipeState {
    if (!rows[key])
      rows[key] = {
        pointerId: -1,
        startX: 0,
        startY: 0,
        dx: 0,
        dy: 0,
        active: false,
        revealed: false,
        samples: [],
      };
    return rows[key];
  }

  function maxTravel(): number {
    const w = rowWidth?.() ?? 0;
    return Math.max(80, (w || revealWidth() * 2.2) - revealWidth());
  }

  function rubber(past: number): number {
    if (past <= 0) return 0;
    const r = maxTravel();
    return (r * past) / (past + r);
  }

  function visualFromFinger(finger: number): number {
    const w = revealWidth();
    if (finger >= -w) return Math.min(0, finger);
    return -(w + rubber(-(finger + w)));
  }

  function offset(key: string): number {
    if (anims[key]) return anims[key].x;
    const s = rows[key];
    if (!s) return 0;
    if (s.active) return visualFromFinger((s.revealed ? -revealWidth() : 0) + s.dx);
    return s.revealed ? -revealWidth() : 0;
  }

  function styleOf(key: string) {
    const a = anims[key];
    const s = rows[key];
    if (!a && (!s || (!s.active && !s.revealed))) return undefined;
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
    if (anims[key]) return offset(key) < -LAYER_EPSILON;
    const s = rows[key];
    if (!s) return false;
    if (s.revealed) return true;
    return s.active && offset(key) < -LAYER_EPSILON;
  }

  function isArmed(key: string): boolean {
    if (anims[key]?.committing) return true;
    const s = rows[key];
    if (!s?.active) return false;
    const travel = -((s.revealed ? -revealWidth() : 0) + s.dx);
    return travel - revealWidth() >= COMMIT_PAST_TRAVEL;
  }

  function isCommitting(key: string): boolean {
    return anims[key]?.committing ?? false;
  }

  function velocityOf(s: SwipeState): number {
    const now = performance.now();
    const recent = s.samples.filter((p) => now - p.t <= SAMPLE_WINDOW);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = last.t - first.t;
    if (dt < 16) return 0;
    return Math.max(-3000, Math.min(3000, ((last.x - first.x) / dt) * 1000));
  }

  function tick() {
    const now = performance.now();
    let live = false;
    for (const key of Object.keys(anims)) {
      const a = anims[key];
      const dt = Math.min(0.032, Math.max(0.001, (now - a.last) / 1000));
      a.last = now;
      a.v += (-a.stiffness * (a.x - a.target) - a.damping * a.v) * dt;
      a.x += a.v * dt;
      if (Math.abs(a.x - a.target) < 1.5 && Math.abs(a.v) < 60) {
        a.x = a.target;
        const done = a.done;
        delete anims[key];
        done?.();
      } else {
        live = true;
      }
    }
    raf = live ? requestAnimationFrame(tick) : 0;
  }

  function springTo(key: string, target: number, v0 = 0) {
    const from = offset(key);
    anims[key] = {
      x: from,
      v: Math.max(-2500, Math.min(2500, v0)),
      target,
      stiffness: SETTLE_STIFFNESS,
      damping: SETTLE_DAMPING,
      committing: false,
      last: 0,
    };
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function commitSlide(key: string) {
    const from = offset(key);
    anims[key] = {
      x: from,
      v: 0,
      target: -(revealWidth() + maxTravel()),
      stiffness: COMMIT_STIFFNESS,
      damping: COMMIT_DAMPING,
      committing: true,
      last: 0,
      done: () => onCommit?.(key),
    };
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function settle(key: string, e?: PointerEvent, cancelled = false) {
    const s = rows[key];
    if (!s) return;
    if (e && s.pointerId !== -1 && e.pointerId !== s.pointerId) return;
    if (s.active) {
      const base = s.revealed ? -revealWidth() : 0;
      const travel = -(base + s.dx);
      const past = travel - revealWidth();
      const v = cancelled ? 0 : velocityOf(s);
      const commit =
        !cancelled && (past >= COMMIT_PAST_TRAVEL || (v <= -FLICK_VELOCITY && travel >= FLICK_MIN_TRAVEL));
      suppressedClick.value = key;
      s.active = false;
      s.pointerId = -1;
      if (commit) {
        s.revealed = false;
        if (commitStyle?.(key) === 'menu') {
          springTo(key, 0, v);
          onCommit?.(key);
        } else {
          commitSlide(key);
        }
        return;
      }
      const open = !cancelled && (travel >= revealWidth() / 2 || v <= -OPEN_FLICK_VELOCITY);
      const closed = !cancelled && s.revealed && s.dx >= revealWidth() * 0.4;
      s.revealed = open || (!closed && s.revealed);
      springTo(key, s.revealed ? -revealWidth() : 0, v);
      return;
    }
    s.pointerId = -1;
  }

  function begin(key: string, e: PointerEvent) {
    const s = stateOf(key);
    if (s.pointerId !== -1 && s.pointerId !== e.pointerId) return;
    if (anims[key]?.committing) return;
    delete anims[key];
    if (suppressedClick.value === key) suppressedClick.value = null;
    s.pointerId = e.pointerId;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.dx = 0;
    s.dy = 0;
    s.active = false;
    s.samples = [{ t: performance.now(), x: e.clientX }];
  }

  function move(e: PointerEvent, key: string) {
    const s = rows[key];
    if (!s) return;
    if (s.pointerId !== -1 && s.pointerId !== e.pointerId) return;
    if (s.pointerId === -1) {
      s.pointerId = e.pointerId;
      s.startX = e.clientX;
      s.startY = e.clientY;
      s.samples = [{ t: performance.now(), x: e.clientX }];
    }
    s.dx = e.clientX - s.startX;
    s.dy = e.clientY - s.startY;
    s.samples.push({ t: performance.now(), x: e.clientX });
    if (s.samples.length > 8) s.samples.splice(0, s.samples.length - 8);
    if (!s.active) {
      if (Math.abs(s.dx) < LOCK_THRESHOLD || Math.abs(s.dx) < Math.abs(s.dy)) return;
      s.active = true;
      delete anims[key];
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
    settle(key, e, false);
  }

  function cancel(key: string, e?: PointerEvent) {
    settle(key, e, true);
  }

  function hide(key: string) {
    const s = rows[key];
    if (!s) return;
    s.revealed = false;
    s.pointerId = -1;
    springTo(key, 0);
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
    for (const k of Object.keys(anims)) {
      if (!keys.has(k)) delete anims[k];
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
    for (const k of Object.keys(anims)) delete anims[k];
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    suppressedClick.value = null;
  }

  return {
    rows,
    anims,
    suppressedClick,
    offset,
    styleOf,
    underWidth,
    isSwiping,
    isRevealed,
    isLayerVisible,
    isArmed,
    isCommitting,
    begin,
    move,
    touchMove,
    end,
    cancel,
    hide,
    consumeClick,
    dropMissing,
    reset,
  };
}
