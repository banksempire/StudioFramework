import { watch, onUnmounted } from 'vue';

/**
 * Close a dropdown / menu when the user clicks outside of it.
 *
 * @param open    the ref controlling the dropdown's visibility (boolean ref,
 *                or a string|null ref where non-null means "open")
 * @param inside  CSS selector(s) that should NOT close the dropdown
 *
 * The document listener is attached on the next tick (setTimeout 0) so the
 * click that opened the dropdown doesn't immediately close it.
 */
export function useClickOutside(open: { value: boolean | string | null }, inside: string | string[]) {
  const selectors = Array.isArray(inside) ? inside : [inside];

  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!selectors.some(sel => target.closest(sel))) open.value = false;
  }

  watch(open, (val) => {
    if (val) {
      setTimeout(() => document.addEventListener('click', onClick), 0);
    } else {
      document.removeEventListener('click', onClick);
    }
  });

  onUnmounted(() => document.removeEventListener('click', onClick));
}
