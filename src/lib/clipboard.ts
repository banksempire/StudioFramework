import { focusedAuxWindow } from '../workspace/auxWindow';
import { hostViewOf } from './overlayHost';

function activeView(anchorEl?: Element | null): Window {
  if (anchorEl) return hostViewOf(anchorEl);
  return focusedAuxWindow() ?? window;
}

function asyncClipboardOf(view: Window): Clipboard | undefined {
  try {
    if (!view.isSecureContext) return undefined;
    return (view.navigator as Navigator).clipboard ?? undefined;
  } catch {
    return undefined;
  }
}

function execCommandCopy(view: Window, text: string): boolean {
  const doc = view.document;
  const body = doc.body;
  if (!body) return false;
  const ta = doc.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-100px';
  ta.style.opacity = '0';
  body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = doc.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export async function copyTextToClipboard(text: string, anchorEl?: Element | null): Promise<void> {
  const view = activeView(anchorEl);
  const clip = asyncClipboardOf(view);
  if (clip?.writeText) {
    try {
      await clip.writeText(text);
      return;
    } catch {}
  }
  if (execCommandCopy(view, text)) return;
  throw new Error('clipboard write rejected');
}
