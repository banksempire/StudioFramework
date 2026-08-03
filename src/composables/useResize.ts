import { ref, onUnmounted } from 'vue';

export interface ResizeOptions {
  /** Minimum visible width in px — panel never displays narrower than this */
  min?: number;
  /** Maximum width in px */
  max?: number;
  /** Which edge the handle is on */
  direction?: 'left' | 'right';
  /** Called on mouseup when width falls below collapseThreshold */
  onCollapse?: () => void;
  /** Called during drag when width changes (live, not just on mouseup) */
  onResize?: (width: number) => void;
  /** Collapse threshold in px - drag below this snaps the panel shut. Defaults to min * 0.45 */
  collapseThreshold?: number;
}

export function useResize(options: ResizeOptions) {
  const {
    min = 180,
    max = 500,
    direction = 'right',
    onCollapse,
    onResize,
    collapseThreshold = Math.round(min * 0.45),
  } = options;

  const sign = direction === 'left' ? -1 : 1;

  const width = ref(260);
  const dragging = ref(false);
  const willCollapse = ref(false);

  let startX = 0;
  let startWidth = 0;
  let rawWidth = 260;

  function displayWidth(raw: number): number {
    // Never show narrower than min — hard visual floor
    return Math.min(max, Math.max(min, raw));
  }

  function onMouseDown(e: MouseEvent) {
    dragging.value = true;
    startX = e.clientX;
    startWidth = width.value;
    rawWidth = width.value;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging.value) return;
    const delta = e.clientX - startX;
    rawWidth = startWidth + delta * sign;
    width.value = displayWidth(rawWidth);
    // Live indicator: glow opposite edge when past collapse threshold
    willCollapse.value = rawWidth <= collapseThreshold;
    onResize?.(width.value);
  }

  function onMouseUp() {
    dragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Reset willCollapse indicator
    willCollapse.value = false;

    if (rawWidth <= collapseThreshold) {
      onCollapse?.();
    } else {
      // Clamp to valid range
      width.value = displayWidth(rawWidth);
    }
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });

  return {
    width,
    dragging,
    willCollapse,
    onMouseDown,
  };
}
