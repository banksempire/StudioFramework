import { createApp } from 'vue';
import WelcomeContent from './components/WelcomeContent.vue';
import WorkspacePanel from './components/WorkspacePanel.vue';
import Framework from './Framework.vue';
import { registerPanelComponent, registerTabContent } from './registry';
import type { WorkspaceApi } from './composables/useWorkspace';

// The demo layout's welcome tab is rendered through the content registry.
registerTabContent('welcome', WelcomeContent);

// The Workspace app (docker item "workspace") — saved-workspace management.
registerPanelComponent('workspace-panel', WorkspacePanel);

// Test hook: the check scripts drive the workspace programmatically where
// there is no UI control (e.g. creating a tab — the strip has no "+").
declare global {
  interface Window {
    __sfWorkspace?: WorkspaceApi;
  }
}

createApp(Framework, { onWorkspaceReady: (api: WorkspaceApi) => (window.__sfWorkspace = api) }).mount(
  '#framework',
);
