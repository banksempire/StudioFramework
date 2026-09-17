export interface FormFieldOption {
  value: string | number;
  label: string;
  title?: string;
}

export type FormFieldTone = 'warn' | 'error';

export type FormFieldType =
  | 'text'
  | 'number'
  | 'password'
  | 'datetime-local'
  | 'textarea'
  | 'select'
  | 'pills'
  | 'slot';

export interface FormField {
  key: string;
  type: FormFieldType;
  label?: string;
  labelNote?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  hintTone?: FormFieldTone;
  mono?: boolean;
  half?: boolean;
  disabled?: boolean;
  rows?: number;
  spellcheck?: boolean;
  options?: FormFieldOption[];
  blankLabel?: string;
  class?: string;
}

export interface FormSection {
  title?: string;
  note?: string;
  fields: FormField[];
}

export interface FormSchema {
  sections: FormSection[];
}

export type FormValues = Record<string, string | number | undefined>;
