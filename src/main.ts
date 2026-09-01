import { createApp, reactive } from 'vue';
import DialogDemo from './components/DialogDemo.vue';
import SelectorDemo from './components/SelectorDemo.vue';
import SingleMenuDemo from './components/SingleMenuDemo.vue';
import WelcomeContent from './components/WelcomeContent.vue';
import WorkspacePanel from './components/WorkspacePanel.vue';
import type { WorkspaceApi } from './composables/useWorkspace';
import Framework, { type FrameworkAction } from './Framework.vue';
import { registerPanelComponent, registerTabContent, registerUtilityMenu } from './registry';

registerTabContent('welcome', WelcomeContent);

registerPanelComponent('workspace-panel', WorkspacePanel);

registerPanelComponent('single-menu-demo', SingleMenuDemo);

registerPanelComponent('selector-demo', SelectorDemo);

registerPanelComponent('dialog-demo', DialogDemo);

const demoFilter = reactive({ sources: true, assets: true });
registerUtilityMenu('demo-filter', () => [
  { id: 'sources', label: 'Sources', iconKind: 'check', selected: demoFilter.sources },
  { id: 'assets', label: 'Assets', iconKind: 'check', selected: demoFilter.assets },
]);

function onAction(e: FrameworkAction) {
  if (e.source === 'utility' && e.action === 'demo-filter' && typeof e.payload === 'string') {
    const key = e.payload as keyof typeof demoFilter;
    demoFilter[key] = !demoFilter[key];
  }
}

declare global {
  interface Window {
    __sfWorkspace?: WorkspaceApi;
  }
}

createApp(Framework, {
  onWorkspaceReady: (api: WorkspaceApi) => (window.__sfWorkspace = api),
  onAction,
}).mount('#framework');
