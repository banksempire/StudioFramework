import { onUnmounted } from 'vue';
import { useHostedTab } from './useHostedTab';
import { useWorkspaceContext } from './useWorkspace';

export interface TabStateChange {
  readonly prev: Record<string, unknown> | undefined;
  readonly next: Record<string, unknown> | undefined;
}

export interface TabResourceLifecycle {
  _on_tab_open_request_resources?(): void;
  _on_tab_close_release_resources?(): void;
  _on_tab_states_change_reload_resources?(change: TabStateChange): void;
}

export function useTabResources(lifecycle: TabResourceLifecycle): void {
  const hosted = useHostedTab();
  if (!hosted) return;
  const ws = useWorkspaceContext();
  ws.registerTabResources(hosted.tabId, lifecycle);
  onUnmounted(() => ws.unregisterTabResources(hosted.tabId, lifecycle));
}
