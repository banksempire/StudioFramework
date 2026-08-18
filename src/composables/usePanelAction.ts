import type { InjectionKey } from 'vue';
import type { PanelAction } from '../types/panel';

export const kPanelAction: InjectionKey<(action: Omit<PanelAction, 'source'>) => void> =
  Symbol('sf.panelAction');
