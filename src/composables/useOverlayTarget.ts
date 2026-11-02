import { onMounted, type Ref, ref } from 'vue';
import { overlayRootOf } from '../lib/overlayHost';

export function useOverlayTarget(): {
  anchorEl: Ref<HTMLElement | null>;
  overlayTarget: Ref<HTMLElement | 'body'>;
  resolve: () => void;
} {
  const anchorEl = ref<HTMLElement | null>(null);
  const overlayTarget = ref<HTMLElement | 'body'>('body');
  const resolve = () => {
    overlayTarget.value = overlayRootOf(anchorEl.value);
  };
  onMounted(resolve);
  return { anchorEl, overlayTarget, resolve };
}
