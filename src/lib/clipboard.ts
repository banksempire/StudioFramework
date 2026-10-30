import { focusedAuxWindow } from '../workspace/auxWindow';
import { hostViewOf } from './overlayHost';

function activeView(anchorEl?: Element | null): Window {
  if (anchorEl) return hostViewOf(anchorEl);
  return focusedAuxWindow() ?? window;
}

export function copyTextToClipboard(text: string, anchorEl?: Element | null): Promise<void> {
  const view = activeView(anchorEl);
  const clip = (view.navigator as Navigator).clipboard;
  if (clip?.writeText) return clip.writeText(text);
  return navigator.clipboard.writeText(text);
}
