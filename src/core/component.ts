// ─── Core: Component base ────────────────────────────────────────────────────

export interface ComponentProps {
  className?: string;
  id?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export class Component<T extends HTMLElement = HTMLElement> {
  public el: T;
  protected children: Component[] = [];

  constructor(tag: string, props?: ComponentProps) {
    this.el = document.createElement(tag) as T;
    if (props?.className) this.el.className = props.className;
    if (props?.id) this.el.id = props.id;
    if (props?.style) Object.assign(this.el.style, props.style);
  }

  addChild(child: Component): this {
    this.children.push(child);
    this.el.appendChild(child.el);
    return this;
  }

  removeChild(child: Component): this {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      this.el.removeChild(child.el);
    }
    return this;
  }

  dispose(): void {
    for (const c of this.children) c.dispose();
    this.children = [];
    this.el.remove();
  }
}

export class Container<
  T extends HTMLElement = HTMLElement
> extends Component<T> {
  constructor(tag: string, props?: ComponentProps) {
    super(tag, props);
  }
}
