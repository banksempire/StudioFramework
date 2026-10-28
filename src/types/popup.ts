export interface PopupOption {
  value: string | number;
  label: string;
  title?: string;
  disabled?: boolean;
  swatch?: string;
  desc?: string;
}

export interface PopupOptionGroup {
  group: string;
  options: PopupOption[];
}

export type PopupChoices = PopupOption[] | PopupOptionGroup[];

export type PopupFieldTone = 'warn' | 'error';

export type PopupFieldType =
  | 'input'
  | 'number'
  | 'password'
  | 'datetime-local'
  | 'textarea'
  | 'select'
  | 'pills'
  | 'multi'
  | 'switch'
  | 'stepper'
  | 'color'
  | 'colorWheel'
  | 'button'
  | 'info'
  | 'time'
  | 'cards'
  | 'search';

export type PopupButtonVariant = 'default' | 'accent' | 'danger' | 'ghost';

export interface PopupField {
  key: string;
  type: PopupFieldType;
  action?: string;
  variant?: PopupButtonVariant;
  label?: string;
  labelNote?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  hintTone?: PopupFieldTone;
  mono?: boolean;
  span?: number;
  line?: string | number;
  disabled?: boolean;
  rows?: number;
  spellcheck?: boolean;
  options?: PopupChoices;
  blankLabel?: string;
  triggerLabel?: string;
  triggerSwatch?: string;
  triggerFill?: boolean;
  emptyLabel?: string;
  emptySwatch?: string;
  min?: number;
  max?: number;
  step?: number;
  shorthand?: boolean;
  id?: string;
  text?: string;
  class?: string;
  inputClass?: string;
}

export interface PopupFieldGroup {
  fields?: PopupField[];
  note?: string;
}

export interface PopupH3 {
  title: string;
  fields: PopupField[];
}

export interface PopupH2 extends PopupFieldGroup {
  title: string;
  fields?: PopupField[];
  list?: { bind: string };
  h3?: PopupH3[];
}

export interface PopupH1 {
  id: string;
  title: string;
  h2: PopupH2[];
}

export type PopupActionTone = 'default' | 'accent' | 'danger';

export interface PopupAction {
  id: string;
  label: string;
  tone?: PopupActionTone;
  align?: 'left' | 'right';
  disabled?: boolean;
  title?: string;
  close?: boolean;
  class?: string;
}

export interface PopupDocument {
  title: string;
  h1: PopupH1[];
  actions?: PopupAction[];
}

export type PopupValue = string | number | boolean | Array<string | number> | undefined;

export type PopupValues = Record<string, PopupValue>;
