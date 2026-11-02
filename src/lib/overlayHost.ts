let interactionDoc: Document | null = null;
let interactionReset: ReturnType<typeof setTimeout> | null = null;

export function beginInteractionDoc(doc: Document): void {
  interactionDoc = doc;
  if (interactionReset !== null) clearTimeout(interactionReset);
  interactionReset = setTimeout(() => {
    interactionDoc = null;
    interactionReset = null;
  }, 0);
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
