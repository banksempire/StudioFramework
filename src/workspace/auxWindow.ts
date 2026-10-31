export interface AuxWindowOptions {
  title: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

export interface AuxWindowHandle {
  readonly id: number;
  readonly window: Window;
  readonly document: Document;
  readonly content: HTMLElement;
  isMobile(): boolean;
  onMobileChange(listener: () => void): () => void;
  close(): void;
  onClosed(listener: () => void): void;
}

const openHandles = new Set<AuxWindowHandle>();

export function focusedAuxWindow(): Window | null {
  for (const handle of openHandles) {
    try {
      if (handle.window.document.hasFocus()) return handle.window;
    } catch {}
  }
  return null;
}

let nextWindowId = 1;

const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');

function absoluteStyleSheetUrl(href: string): string | null {
  try {
    return new URL(href, document.baseURI).href;
  } catch {
    return null;
  }
}

function cloneStyleNode(node: Element): Element | null {
  if (node instanceof HTMLStyleElement) {
    const style = document.createElement('style');
    style.textContent = node.textContent;
    return style;
  }
  if (node instanceof HTMLLinkElement) {
    const href = node.getAttribute('href');
    if (!href) return null;
    const abs = absoluteStyleSheetUrl(href);
    if (!abs) return null;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute('href', abs);
    return link;
  }
  return null;
}

function syncAuxStyles(popupDoc: Document, cloned: Map<Element, Element>) {
  const sources = new Set<Element>();
  for (const node of Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))) {
    sources.add(node);
    let clone = cloned.get(node);
    if (!clone?.isConnected) {
      const fresh = cloneStyleNode(node);
      if (!fresh) continue;
      clone = fresh;
      cloned.set(node, clone);
      popupDoc.head.appendChild(clone);
    } else if (node instanceof HTMLStyleElement && clone instanceof HTMLStyleElement) {
      if (clone.textContent !== node.textContent) clone.textContent = node.textContent;
    } else if (node instanceof HTMLLinkElement && clone instanceof HTMLLinkElement) {
      const href = node.getAttribute('href');
      const abs = href ? absoluteStyleSheetUrl(href) : null;
      if (abs && clone.getAttribute('href') !== abs) clone.setAttribute('href', abs);
    }
  }
  for (const [source, clone] of [...cloned]) {
    if (!sources.has(source)) {
      clone.remove();
      cloned.delete(source);
    }
  }
}

export function openAuxWindow(options: AuxWindowOptions): AuxWindowHandle | null {
  const width = options.width ?? 960;
  const height = options.height ?? 720;
  const left = options.left ?? Math.max(0, Math.round(window.screenX ?? 0) + 56 + nextWindowId * 28);
  const top = options.top ?? Math.max(0, Math.round(window.screenY ?? 0) + 96 + nextWindowId * 28);
  const features = ['popup=yes', `left=${left}`, `top=${top}`, `width=${width}`, `height=${height}`].join(
    ',',
  );
  const popup = window.open(isFirefox ? '' : 'about:blank', '_blank', features);
  if (!popup) return null;

  const id = nextWindowId++;
  const doc = popup.document;
  doc.title = options.title;

  const reset = document.createElement('style');
  reset.textContent = 'html,body{margin:0;padding:0;height:100%;overflow:hidden}body{background:#000}';
  doc.head.appendChild(reset);

  const cloned = new Map<Element, Element>();
  syncAuxStyles(doc, cloned);
  const observer = new MutationObserver(() => syncAuxStyles(doc, cloned));
  observer.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });

  const shell = document.createElement('div');
  shell.className = 'sf-root sf-overlay-root sf-aux-shell';
  const content = document.createElement('div');
  content.className = 'sf-aux-content';
  content.setAttribute('data-test', 'aux-content');
  shell.append(content);
  doc.body.appendChild(shell);

  const mobileListeners = new Set<() => void>();
  const mobileMq = popup.matchMedia('(max-width: 499px)');
  const applyMobile = () => {
    shell.classList.toggle('sf-root--mobile', mobileMq.matches);
    for (const listener of mobileListeners) listener();
  };
  applyMobile();
  try {
    mobileMq.addEventListener('change', applyMobile);
  } catch {
    mobileMq.addListener(applyMobile);
  }

  const listeners: Array<() => void> = [];
  let closed = false;
  const notify = () => {
    if (closed) return;
    closed = true;
    observer.disconnect();
    openHandles.delete(handle);
    for (const listener of listeners) listener();
  };
  popup.addEventListener('pagehide', notify, { once: true });

  const handle: AuxWindowHandle = {
    id,
    window: popup,
    document: doc,
    content,
    isMobile: () => mobileMq.matches,
    onMobileChange(listener: () => void) {
      mobileListeners.add(listener);
      return () => mobileListeners.delete(listener);
    },
    close() {
      if (closed) return;
      try {
        popup.close();
      } catch {}
      setTimeout(notify, 250);
    },
    onClosed(listener: () => void) {
      listeners.push(listener);
    },
  };
  openHandles.add(handle);
  return handle;
}
