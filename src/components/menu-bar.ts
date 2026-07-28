import { Component } from '../core/component.js';

export class MenuBar extends Component {
  private menuContainer: Component;

  constructor() {
    super('div', { className: 'sf-menu-bar' });

    this.menuContainer = new Component('div', { className: 'sf-menu-items' });
    this.el.appendChild(this.menuContainer.el);
  }

  addMenu(label: string, items: { label: string; action?: () => void; separator?: boolean }[]): this {
    const menuItem = document.createElement('div');
    menuItem.className = 'sf-menu-item';
    menuItem.textContent = label;

    const dropdown = document.createElement('div');
    dropdown.className = 'sf-menu-dropdown';

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'sf-menu-separator';
        dropdown.appendChild(sep);
      } else {
        const dropItem = document.createElement('div');
        dropItem.className = 'sf-menu-dropdown-item';
        dropItem.textContent = item.label;
        dropItem.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeAllDropdowns();
          item.action?.();
        });
        dropdown.appendChild(dropItem);
      }
    }

    menuItem.appendChild(dropdown);

    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      this.closeAllDropdowns();
      if (!isOpen) dropdown.classList.add('open');
    });

    menuItem.addEventListener('mouseenter', () => {
      // open on hover if any dropdown is open
      const anyOpen = this.el.querySelector('.sf-menu-dropdown.open');
      if (anyOpen) {
        this.closeAllDropdowns();
        dropdown.classList.add('open');
      }
    });

    this.menuContainer.el.appendChild(menuItem);
    return this;
  }

  private closeAllDropdowns(): void {
    this.el.querySelectorAll('.sf-menu-dropdown.open').forEach(d => d.classList.remove('open'));
  }

  dispose(): void {
    // close all on document click
    document.removeEventListener('click', this._docClickHandler);
    super.dispose();
  }

  private _docClickHandler = (): void => {
    this.closeAllDropdowns();
  };

}

// Attach global click to close
document.addEventListener('click', () => {
  document.querySelectorAll('.sf-menu-dropdown.open').forEach(d => d.classList.remove('open'));
});
