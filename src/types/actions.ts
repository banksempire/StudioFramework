export interface FrameworkAction {
  source: 'menu' | 'utility' | 'panel';
  action?: string;
  subId?: string;
  component?: string;
  payload?: unknown;
  auxWindow?: number;
}
