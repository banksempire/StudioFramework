import { type InjectionKey, inject, type Ref } from 'vue';

export interface HostedTabContext {
  readonly tabId: string;
  readonly visible: Ref<boolean>;
}

export const kHostedTab: InjectionKey<HostedTabContext> = Symbol('sf.hostedTab');

export function useHostedTab(): HostedTabContext | null {
  return inject(kHostedTab, null);
}
