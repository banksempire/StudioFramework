export interface TableColumn {
  key: string;
  label: string;
  fixedWidth?: number;
  min?: number;
  max?: number;
  hidden?: boolean;
  sortable?: boolean;
  filter?: boolean | 'text' | 'select';
  align?: 'left' | 'right' | 'center';
  mobile?: 'lead' | 'title' | 'sub' | 'hidden';
}
