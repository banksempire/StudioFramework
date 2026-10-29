import type { Component } from 'vue';
import type { MenuNodeDef } from './types/layout';

const tabContent = new Map<string, Component>();
const panelComponents = new Map<string, Component>();
const builtinPanelComponents = new Set<string>();
const statusComponents = new Map<string, Component>();
const utilityMenus = new Map<string, () => MenuNodeDef[]>();
const panelData = new Map<string, () => unknown>();

export function registerTabContent(key: string, component: Component): void {
  tabContent.set(key, component);
}

export function getTabContent(key: string): Component | undefined {
  return tabContent.get(key);
}

export function registerBuiltinPanelComponent(key: string, component: Component): void {
  panelComponents.set(key, component);
  builtinPanelComponents.add(key);
}

export function registerPanelComponent(): never {
  throw new Error(
    '[StudioFramework] registerPanelComponent() is reserved for framework built-ins — ' +
      'downstream apps cannot render custom components in JSON layouts. ' +
      'Compose the existing layout components and field types instead. ' +
      `Registered built-ins: ${[...builtinPanelComponents].join(', ') || 'none'}. ` +
      'If something is genuinely missing, implement it in StudioFramework first.',
  );
}

export function getPanelComponent(key: string): Component | undefined {
  if (!panelComponents.has(key)) {
    throw new Error(
      `[StudioFramework] unknown panel component "${key}" — ` +
        `registered built-ins: ${[...builtinPanelComponents].join(', ') || 'none'}`,
    );
  }
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

export function registerPanelData(key: string, getter: () => unknown): void {
  panelData.set(key, getter);
}

export function getPanelData(key: string): (() => unknown) | undefined {
  return panelData.get(key);
}

export function panelDataHidden(bind: string | undefined): boolean {
  if (!bind) return false;
  const getter = getPanelData(bind);
  if (!getter) return false;
  const value = getter() as { hidden?: unknown } | undefined;
  return value?.hidden === true;
}
