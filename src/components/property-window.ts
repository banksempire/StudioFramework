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

export class PropertyWindow extends Component {
  private contents: Component;

  constructor() {
    super('div', { className: 'sf-property-window' });

    const header = document.createElement('div');
    header.className = 'sf-property-window-header';
    header.textContent = 'Properties';
    this.el.appendChild(header);

    this.contents = new Component('div', { className: 'sf-property-sections' });
    this.el.appendChild(this.contents.el);
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
