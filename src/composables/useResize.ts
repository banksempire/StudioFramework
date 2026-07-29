import { ref, onUnmounted } from 'vue';

export function useResize(options: {
  min?: number;
  max?: number;
  direction?: 'left' | 'right';
  onResize?: (width: number) => void;
}) {
  const { min = 180, max = 500, direction = 'right', onResize } = options;
  const sign = direction === 'left' ? -1 : 1;

  const width = ref(260);
  const dragging = ref(false);
  let startX = 0;
  let startWidth = 0;

  function onMouseDown(e: MouseEvent) {
    dragging.value = true;
    startX = e.clientX;
    startWidth = width.value;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging.value) return;
    const delta = e.clientX - startX;
    const newWidth = Math.min(max, Math.max(min, startWidth + delta * sign));
    width.value = newWidth;
    onResize?.(newWidth);
  }

  function onMouseUp() {
    dragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });

  return {
    width,
    dragging,
    onMouseDown,
  };
}
