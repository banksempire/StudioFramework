import { onUnmounted, type Ref, ref } from 'vue';

const MOBILE_BREAKPOINT = 500;
const fallback = ref(window.innerWidth < MOBILE_BREAKPOINT);
let listening = false;

export function useFallbackMobile(): Ref<boolean> {
  if (!listening) {
    listening = true;
    window.addEventListener('resize', () => {
      fallback.value = window.innerWidth < MOBILE_BREAKPOINT;
    });
  }
  onUnmounted(() => {});
  return fallback;
}
