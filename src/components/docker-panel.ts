import { Component } from '../core/component.js';

export class DockerPanel extends Component {
  private titleEl: HTMLElement;
  private contentEl: HTMLElement;
  private _visible: boolean = true;
  private width: number = 260;

  constructor(title: string = 'Explorer') {
    super('div', { className: 'sf-docker-panel' });

    const header = document.createElement('div');
    header.className = 'sf-docker-panel-header';

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'sf-docker-panel-title';
    this.titleEl.textContent = title;
    header.appendChild(this.titleEl);

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'sf-docker-panel-collapse';
    collapseBtn.textContent = '✕';
    collapseBtn.addEventListener('click', () => this.toggle());
    header.appendChild(collapseBtn);

    this.el.appendChild(header);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'sf-docker-panel-content';
    this.el.appendChild(this.contentEl);
  }

  setContent(component: Component): this {
    this.contentEl.innerHTML = '';
    this.contentEl.appendChild(component.el);
    return this;
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
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
}
