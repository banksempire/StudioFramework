import { Component } from '../core/component.js';

export interface StatusItem {
  text: string;
  align?: 'left' | 'right';
  tooltip?: string;
}

export class StatusBar extends Component {
  private leftEl: HTMLElement;
  private rightEl: HTMLElement;

  constructor() {
    super('div', { className: 'sf-status-bar' });

    this.leftEl = document.createElement('div');
    this.leftEl.className = 'sf-status-left';
    this.el.appendChild(this.leftEl);

    this.rightEl = document.createElement('div');
    this.rightEl.className = 'sf-status-right';
    this.el.appendChild(this.rightEl);
  }

  setItems(items: StatusItem[]): void {
    this.leftEl.innerHTML = '';
    this.rightEl.innerHTML = '';

    for (const item of items) {
      const span = document.createElement('span');
      span.className = 'sf-status-item';
      span.textContent = item.text;
      if (item.tooltip) span.title = item.tooltip;

      if (item.align === 'right') {
        this.rightEl.appendChild(span);
      } else {
        this.leftEl.appendChild(span);
      }
    }
  }
}
