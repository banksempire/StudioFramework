import { createApp } from 'vue';
import WelcomeContent from './components/WelcomeContent.vue';
import WorkspacePanel from './components/WorkspacePanel.vue';
import Framework from './Framework.vue';
import { registerPanelComponent, registerTabContent } from './registry';

// The demo layout's welcome tab is rendered through the content registry.
registerTabContent('welcome', WelcomeContent);

// The Workspace app (docker item "workspace") — saved-workspace management.
registerPanelComponent('workspace-panel', WorkspacePanel);

createApp(Framework).mount('#framework');
