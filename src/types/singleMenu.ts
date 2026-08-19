import type { IconDef } from './panel';

export interface SingleMenuOption {
  id: string;
  label?: string;
  icon?: IconDef;
  danger?: boolean;
  disabled?: boolean;
}
