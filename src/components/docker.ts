import { Component } from '../core/component.js';

export interface DockerTagConfig {
  id: string;
  icon: string;
  label: string;
  badge?: number;
}

export class Docker extends Component {
  private tags: Map<string, { el: HTMLElement; config: DockerTagConfig }> = new Map();
  private activeTagId: string | null = null;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  private lastClickedTagId: string | null = null;
  public onTagSelected?: (tagId: string) => void;
  public onTagDoubleClicked?: (tagId: string) => void;

  constructor() {
    super('div', { className: 'sf-docker' });

    const handle = document.createElement('div');
    handle.className = 'sf-docker-handle';
    this.el.appendChild(handle);
  }

  addTag(config: DockerTagConfig): this {
    const tagEl = document.createElement('div');
    tagEl.className = 'sf-docker-tag';
    tagEl.title = config.label;

    const icon = document.createElement('span');
    icon.className = 'sf-docker-tag-icon';
    icon.textContent = config.icon;
    tagEl.appendChild(icon);

    if (config.badge !== undefined && config.badge > 0) {
      const badge = document.createElement('span');
      badge.className = 'sf-docker-tag-badge';
      badge.textContent = String(config.badge);
      tagEl.appendChild(badge);
    }

    tagEl.addEventListener('click', () => {
      this.setActive(config.id);

      // Double-click detection
      if (this.clickTimer && this.lastClickedTagId === config.id) {
        // Double click
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
        this.lastClickedTagId = null;
        this.onTagDoubleClicked?.(config.id);
      } else {
        // First click — wait to see if it's a double-click
        this.lastClickedTagId = config.id;
        this.clickTimer = setTimeout(() => {
          this.clickTimer = null;
          this.lastClickedTagId = null;
          this.onTagSelected?.(config.id);
        }, 300);
      }
    });

    this.el.appendChild(tagEl);
    this.tags.set(config.id, { el: tagEl, config });
    return this;
  }

  setActive(tagId: string): void {
    this.tags.forEach(({ el }) => el.classList.remove('active'));
    const tag = this.tags.get(tagId);
    if (tag) {
      tag.el.classList.add('active');
      this.activeTagId = tagId;
    }
  }

  getActiveTagId(): string | null {
    return this.activeTagId;
  }
}
