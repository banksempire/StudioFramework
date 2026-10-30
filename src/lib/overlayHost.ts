export function hostDocOf(el: Element | null | undefined): Document {
  return el?.ownerDocument ?? document;
}

export function overlayRootOf(el: Element | null | undefined): HTMLElement | 'body' {
  const root = hostDocOf(el).querySelector('.sf-overlay-root') as HTMLElement | null;
  return root ?? 'body';
}

export function hostViewOf(el: Element | null | undefined): Window {
  return (el?.ownerDocument?.defaultView ?? window) as Window;
}
