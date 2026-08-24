import { ref } from 'vue';

export const PANEL_MIN_WIDTH = 150;
export const PANEL_MAX_WIDTH = 500;
export const DEFAULT_PANEL_WIDTH = 260;

export interface ResizeOptions {
  min?: number;
  max?: number;
  initial?: number;
  direction?: 'left' | 'right';
  onCollapse?: () => void;
  onResize?: (width: number) => void;
  collapseThreshold?: number;
}

export function useResize(options: ResizeOptions) {
  const {
    min = 180,
    max = 500,
    initial = 260,
    direction = 'right',
    onCollapse,
    onResize,
    collapseThreshold = Math.round(min * 0.45),
  } = options;

  const sign = direction === 'left' ? -1 : 1;

  const width = ref(Math.min(max, Math.max(min, initial)));
  const dragging = ref(false);
  const willCollapse = ref(false);

  let startX = 0;
  let startWidth = 0;
  let rawWidth = initial;
  let handleEl: HTMLElement | null = null;
  let pointerId = 0;

  function displayWidth(raw: number): number {
    return Math.min(max, Math.max(min, raw));
  }

  function onPointerDown(e: PointerEvent) {
    dragging.value = true;
    startX = e.clientX;
    startWidth = width.value;
    rawWidth = width.value;
    handleEl = e.currentTarget as HTMLElement;
    pointerId = e.pointerId;
    handleEl.setPointerCapture(pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return;
    const delta = e.clientX - startX;
    rawWidth = startWidth + delta * sign;
    width.value = displayWidth(rawWidth);
    willCollapse.value = rawWidth <= collapseThreshold;
    onResize?.(width.value);
  }

  function onPointerUp() {
    if (!dragging.value) return;
    dragging.value = false;
    handleEl?.releasePointerCapture(pointerId);
    handleEl = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    willCollapse.value = false;

    if (rawWidth <= collapseThreshold) {
      onCollapse?.();
    }
  }

  return {
    width,
    dragging,
    willCollapse,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
