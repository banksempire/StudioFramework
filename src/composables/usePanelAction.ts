import type { InjectionKey } from 'vue';
import type { PanelAction } from '../types/panel';

/**
 * Injection key for custom panel components (`type: 'component'`).
 * The component receives a dispatch function that wraps its payload into a
 * PanelAction (source = the component's layout key) and emits it up the
 * panel chain to the framework root.
 */
export const kPanelAction: InjectionKey<(action: Omit<PanelAction, 'source'>) => void> =
  Symbol('sf.panelAction');
