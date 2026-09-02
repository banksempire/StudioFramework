export interface TableColumn {
  key: string;
  label: string;
  width?: number;
  min?: number;
  sortable?: boolean;
  filter?: boolean | 'text' | 'select';
  align?: 'left' | 'right' | 'center';
  mobile?: 'lead' | 'title' | 'sub' | 'hidden';
}
