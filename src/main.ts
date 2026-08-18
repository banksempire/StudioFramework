import { createApp } from 'vue';
import WelcomeContent from './components/WelcomeContent.vue';
import WorkspacePanel from './components/WorkspacePanel.vue';
import type { WorkspaceApi } from './composables/useWorkspace';
import Framework from './Framework.vue';
import { registerPanelComponent, registerTabContent } from './registry';

registerTabContent('welcome', WelcomeContent);

registerPanelComponent('workspace-panel', WorkspacePanel);

declare global {
  interface Window {
    __sfWorkspace?: WorkspaceApi;
  }
}

createApp(Framework, { onWorkspaceReady: (api: WorkspaceApi) => (window.__sfWorkspace = api) }).mount(
  '#framework',
);
