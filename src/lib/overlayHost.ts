let interactionDoc: Document | null = null;

export function setInteractionDoc(doc: Document | null): void {
  interactionDoc = doc;
}

function resolveDoc(el: Element | null | undefined): Document {
  return interactionDoc ?? el?.ownerDocument ?? document;
}

export function hostDocOf(el: Element | null | undefined): Document {
  return resolveDoc(el);
}

export function overlayRootOf(el: Element | null | undefined): HTMLElement | 'body' {
  const root = resolveDoc(el).querySelector('.sf-overlay-root') as HTMLElement | null;
  return root ?? 'body';
}

export function hostViewOf(el: Element | null | undefined): Window {
  return (resolveDoc(el).defaultView ?? window) as Window;
}

export interface ViewBinding {
  sync(anchor: Element | null | undefined): void;
  release(): void;
}

export function createViewListenerBinder(
  attach: (view: Window) => void,
  detach: (view: Window) => void,
): ViewBinding {
  let bound: Window | null = null;
  return {
    sync(anchor) {
      const next = hostViewOf(anchor);
      if (bound === next) return;
      if (bound) detach(bound);
      bound = next;
      attach(next);
    },
    release() {
      if (!bound) return;
      detach(bound);
      bound = null;
    },
  };
}

export function clampIntoView(
  view: Window,
  x: number,
  y: number,
  w: number,
  h: number,
): { left: number; top: number } {
  return {
    left: Math.max(4, Math.min(x, view.innerWidth - w - 4)),
    top: Math.max(4, Math.min(y, view.innerHeight - h - 4)),
  };
}
