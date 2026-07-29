import { Component } from '../core/component.js';

export interface PropertySection {
  title: string;
  fields: PropertyField[];
}

export interface PropertyField {
  label: string;
  value: string;
  type: 'text' | 'number' | 'checkbox' | 'select';
  options?: string[];
  onChange?: (value: string | boolean | number) => void;
}

export class PropertyPanel extends Component {
  private contents: Component;
  private _visible: boolean = true;
  private width: number = 260;

  constructor() {
    super('div', { className: 'sf-property-panel' });

    const header = document.createElement('div');
    header.className = 'sf-property-panel-header';
    header.textContent = 'Properties';
    this.el.appendChild(header);

    this.contents = new Component('div', { className: 'sf-property-sections' });
    this.el.appendChild(this.contents.el);
  }

  toggle(): void {
    if (this._visible) this.collapse();
    else this.expand();
  }

  expand(): void {
    this._visible = true;
    this.el.style.width = this.width + 'px';
    this.el.style.display = '';
  }

  collapse(): void {
    this._visible = false;
    this.el.style.width = '0';
    this.el.style.display = 'none';
  }

  get visible(): boolean {
    return this._visible;
  }

  setSections(sections: PropertySection[]): void {
    this.contents.el.innerHTML = '';

    for (const section of sections) {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'sf-property-section';

      const titleEl = document.createElement('div');
      titleEl.className = 'sf-property-section-title';
      titleEl.textContent = section.title;
      sectionEl.appendChild(titleEl);

      for (const field of section.fields) {
        const fieldRow = document.createElement('div');
        fieldRow.className = 'sf-property-field';

        const label = document.createElement('label');
        label.textContent = field.label;
        fieldRow.appendChild(label);

        if (field.type === 'checkbox') {
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = field.value === 'true' || field.value === '✓';
          input.addEventListener('change', () => field.onChange?.(input.checked));
          fieldRow.appendChild(input);
        } else if (field.type === 'select' && field.options) {
          const select = document.createElement('select');
          for (const opt of field.options) {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            option.selected = opt === field.value;
            select.appendChild(option);
          }
          select.addEventListener('change', () => field.onChange?.(select.value));
          fieldRow.appendChild(select);
        } else {
          const input = document.createElement('input');
          input.type = field.type === 'number' ? 'number' : 'text';
          input.value = field.value;
          input.addEventListener('change', () => {
            const val = field.type === 'number' ? Number(input.value) : input.value;
            field.onChange?.(val);
          });
          fieldRow.appendChild(input);
        }

        sectionEl.appendChild(fieldRow);
      }

      this.contents.el.appendChild(sectionEl);
    }
  }
}
