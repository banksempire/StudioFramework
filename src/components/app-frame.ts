import { Component } from '../core/component.js';

export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
  closable?: boolean;
}

export class AppFrame extends Component {
  private tabBar: Component;
  private tabContainer: HTMLElement;
  private panelContainer: HTMLElement;
  private tabs: Map<string, { el: HTMLElement; config: TabConfig }> = new Map();
  private activeTabId: string | null = null;
  public onTabSelected?: (tabId: string) => void;
  public onTabClosed?: (tabId: string) => void;

  constructor() {
    super('div', { className: 'sf-app-frame' });

    // Tab bar
    this.tabBar = new Component('div', { className: 'sf-tab-bar' });
    this.tabContainer = document.createElement('div');
    this.tabContainer.className = 'sf-tab-container';
    this.tabBar.el.appendChild(this.tabContainer);

    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'sf-tab-new';
    newTabBtn.textContent = '+';
    newTabBtn.addEventListener('click', () => {
      this.onTabSelected?.('__new__');
    });
    this.tabBar.el.appendChild(newTabBtn);

    this.el.appendChild(this.tabBar.el);

    // Panel container
    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'sf-panel-container';
    this.el.appendChild(this.panelContainer);
  }

  addTab(config: TabConfig): this {
    const tabEl = document.createElement('div');
    tabEl.className = 'sf-tab';
    tabEl.setAttribute('data-tab-id', config.id);

    if (config.icon) {
      const icon = document.createElement('span');
      icon.className = 'sf-tab-icon';
      icon.textContent = config.icon;
      tabEl.appendChild(icon);
    }

    const label = document.createElement('span');
    label.className = 'sf-tab-label';
    label.textContent = config.label;
    tabEl.appendChild(label);

    if (config.closable !== false) {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'sf-tab-close';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTab(config.id);
        this.onTabClosed?.(config.id);
      });
      tabEl.appendChild(closeBtn);
    }

    tabEl.addEventListener('click', () => {
      this.setActiveTab(config.id);
      this.onTabSelected?.(config.id);
    });

    this.tabContainer.appendChild(tabEl);
    this.tabs.set(config.id, { el: tabEl, config });

    // Auto-activate first tab
    if (this.tabs.size === 1) {
      this.setActiveTab(config.id);
    }

    return this;
  }

  removeTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    tab.el.remove();
    this.tabs.delete(tabId);

    if (this.activeTabId === tabId) {
      const next = this.tabs.keys().next().value;
      if (next) this.setActiveTab(next);
      else this.activeTabId = null;
    }
  }

  setActiveTab(tabId: string): void {
    this.tabs.forEach(({ el }) => el.classList.remove('active'));
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.el.classList.add('active');
      this.activeTabId = tabId;
    }
  }

  setPanelContent(component: Component): this {
    this.panelContainer.innerHTML = '';
    this.panelContainer.appendChild(component.el);
    return this;
  }

  getPanelContainer(): HTMLElement {
    return this.panelContainer;
  }
}
