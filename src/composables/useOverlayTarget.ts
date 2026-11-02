import { onMounted, type Ref, ref } from 'vue';
import { overlayRootOf } from '../lib/overlayHost';

export function useOverlayTarget(): {
  anchorEl: Ref<HTMLElement | null>;
  overlayTarget: Ref<HTMLElement | 'body'>;
} {
  const anchorEl = ref<HTMLElement | null>(null);
  const overlayTarget = ref<HTMLElement | 'body'>('body');
  onMounted(() => {
    overlayTarget.value = overlayRootOf(anchorEl.value);
  });
  return { anchorEl, overlayTarget };
}
