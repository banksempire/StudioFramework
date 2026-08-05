import type { Component } from 'vue';

/**
 * Global renderer registries. The layout JSON references renderers by key;
 * host apps register their components here at startup.
 *
 * - Tab content:  `content` on a WorkspaceTabDef (e.g. "chat-window").
 * - Panel content: `{ type: 'component', key }` in a sub-section.
 */
const tabContent = new Map<string, Component>();
const panelComponents = new Map<string, Component>();

/** Register the component that renders a workspace tab's content by key. */
export function registerTabContent(key: string, component: Component): void {
  tabContent.set(key, component);
}

/** Look up a registered tab-content renderer. */
export function getTabContent(key: string): Component | undefined {
  return tabContent.get(key);
}

/** Register a custom panel component by key. */
export function registerPanelComponent(key: string, component: Component): void {
  panelComponents.set(key, component);
}

/** Look up a registered custom panel component. */
export function getPanelComponent(key: string): Component | undefined {
  return panelComponents.get(key);
}
