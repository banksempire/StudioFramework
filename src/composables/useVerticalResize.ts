import { ref, onUnmounted } from 'vue';

export interface VerticalResizeOptions {
  /** Minimum height in px for the sub-section above the handle */
  min?: number;
  /** Called on mousedown */
  onDragStart?: () => void;
  /** Called on mousemove with the delta from start */
  onDrag?: (delta: number) => void;
  /** Called on mouseup */
  onDragEnd?: () => void;
}

export function useVerticalResize(options: VerticalResizeOptions = {}) {
  const { min = 60, onDragStart, onDrag, onDragEnd } = options;

  const dragging = ref(false);

  let startY = 0;

  function onMouseDown(e: MouseEvent) {
    dragging.value = true;
    startY = e.clientY;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    onDragStart?.();
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging.value) return;
    const delta = e.clientY - startY;
    onDrag?.(delta);
    startY = e.clientY;
  }

  function onMouseUp() {
    dragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onDragEnd?.();
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });

  return {
    dragging,
    min,
    onMouseDown,
  };
}
