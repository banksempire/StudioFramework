import type { Component } from 'vue';
import type { MenuNodeDef } from './types/layout';

const tabContent = new Map<string, Component>();
const panelComponents = new Map<string, Component>();
const statusComponents = new Map<string, Component>();
const utilityMenus = new Map<string, () => MenuNodeDef[]>();

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

export function registerUtilityMenu(key: string, provider: () => MenuNodeDef[]): void {
  utilityMenus.set(key, provider);
}

export function getUtilityMenu(key: string): (() => MenuNodeDef[]) | undefined {
  return utilityMenus.get(key);
}
