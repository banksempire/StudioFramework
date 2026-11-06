import type { Ref } from 'vue';
import { ref } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface SfPwaInstallState {
  bound: boolean;
  canInstall: Ref<boolean>;
  prompt: (() => Promise<'accepted' | 'dismissed'>) | null;
}

const win = window as typeof window & { __sfPwaInstall?: SfPwaInstallState };
const state: SfPwaInstallState = win.__sfPwaInstall ?? {
  bound: false,
  canInstall: ref(false),
  prompt: null,
};
win.__sfPwaInstall = state;

if (!state.bound) {
  state.bound = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const event = e as BeforeInstallPromptEvent;
    state.prompt = async () => (await event.userChoice).outcome;
    state.canInstall.value = true;
  });
  window.addEventListener('appinstalled', () => {
    state.prompt = null;
    state.canInstall.value = false;
  });
}

export function usePwaInstall() {
  return {
    canInstall: state.canInstall,
    promptInstall: async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
      if (!state.prompt) return 'unavailable';
      try {
        return await state.prompt();
      } catch {
        return 'unavailable';
      } finally {
        state.prompt = null;
        state.canInstall.value = false;
      }
    },
  };
}
