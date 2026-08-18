import type { Component } from 'vue';

const tabContent = new Map<string, Component>();
const panelComponents = new Map<string, Component>();
const statusComponents = new Map<string, Component>();

export function registerTabContent(key: string, component: Component): void {
  tabContent.set(key, component);
}

export function getTabContent(key: string): Component | undefined {
  return tabContent.get(key);
}

export function registerPanelComponent(key: string, component: Component): void {
  panelComponents.set(key, component);
}

export function getPanelComponent(key: string): Component | undefined {
  return panelComponents.get(key);
}

export function registerStatusComponent(key: string, component: Component): void {
  statusComponents.set(key, component);
}

export function getStatusComponent(key: string): Component | undefined {
  return statusComponents.get(key);
}
