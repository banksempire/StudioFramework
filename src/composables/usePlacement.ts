import { type ComputedRef, computed } from 'vue';
import { useHostedTab } from './useHostedTab';
import { useWorkspaceContext } from './useWorkspace';

export interface Placement {
  windowId: number;
}

export function usePlacement(): ComputedRef<Placement> {
  const ws = useWorkspaceContext();
  const hosted = useHostedTab();
  return computed(() => {
    if (hosted) return { windowId: ws.tabWindow(hosted.tabId) ?? 0 };
    return { windowId: ws.ownWindowId };
  });
}
