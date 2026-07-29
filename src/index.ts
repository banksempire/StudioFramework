// Vue 3 component exports (the real app uses .vue SFCs directly)
export { default as Panel } from './components/Panel.vue';
export { default as PanelSubSection } from './components/PanelSubSection.vue';
export { default as PanelComponent } from './components/PanelComponent.vue';

// Types
export * from './types/panel.js';

// Legacy DOM-based components (no longer imported by the Vue app)
export { Component, Container } from './core/component.js';
export { MenuBar } from './components/menu-bar.js';
export { Docker } from './components/docker.js';
export type { DockerTagConfig } from './components/docker.js';
export { DockerPanel } from './components/docker-panel.js';
export { Workspace } from './components/workspace.js';
export type { TabConfig } from './components/workspace.js';
export { RightPanel } from './components/right-panel.js';
export type { PropertySection, PropertyField } from './components/right-panel.js';
export { StatusBar } from './components/status-bar.js';
export type { StatusItem } from './components/status-bar.js';
