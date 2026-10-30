import type { InjectionKey } from 'vue';
import {
  BLANK_CONTENT,
  type ExternalDropTarget,
  TAB_TRANSFER_TYPE,
  type WorkspaceApi,
} from '../composables/useWorkspace';
import type { WorkspaceTabDef } from '../types/layout';

const CLAIM_CHANNEL_PREFIX = 'sf.aux.channel.';
const DRAG_CHANNEL_PREFIX = 'sf.aux.dragged-over.';
const TRANSFER_KEY_PREFIX = 'sf.aux.transfer.';
const TRANSFER_TTL_MS = 30_000;
const CLAIM_TIMEOUT_MS = 30_000;

export type AuxWindowMode = 'primary' | 'aux';

export type AuxClaimResult = 'claimed' | 'no-token' | 'stale';

export interface AuxBridge {
  readonly mode: AuxWindowMode;
  onTabDragStart(e: DragEvent, tabId: string): void;
  onTabDragEnd(e: DragEvent, tabId: string): void;
  onInternalDrop(tabId?: string): void;
  onTransferDrop(e: DragEvent, target: ExternalDropTarget): void;
  claimPendingFromUrl(): AuxClaimResult;
  dispose(): void;
}

interface PendingTransfer {
  token: string;
  tabId: string;
  timer: ReturnType<typeof setTimeout> | null;
}

interface TransferPayload {
  def: Omit<WorkspaceTabDef, 'tabClass' | 'transient'>;
  at: number;
}

export const kAuxBridge: InjectionKey<AuxBridge> = Symbol('sf.auxBridge');

export function isAuxWindowRequest(): boolean {
  return new URLSearchParams(window.location.search).has('aux');
}

function rid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function windowId(): string {
  const w = window as { __sfAuxWindowId?: string };
  if (!w.__sfAuxWindowId) {
    try {
      w.__sfAuxWindowId = sessionStorage.getItem('sf.aux.windowId') ?? '';
    } catch {}
    if (!w.__sfAuxWindowId) w.__sfAuxWindowId = rid();
    try {
      sessionStorage.setItem('sf.aux.windowId', w.__sfAuxWindowId);
    } catch {}
  }
  return w.__sfAuxWindowId;
}

let dragFlag = false;
let dragChannel: BroadcastChannel | null = null;

function ensureDragTracker(): void {
  if (dragChannel) return;
  dragChannel = new BroadcastChannel(DRAG_CHANNEL_PREFIX + location.pathname);
  dragChannel.onmessage = (e: MessageEvent) => {
    dragFlag = e.data === true;
  };
  document.addEventListener(
    'dragover',
    () => {
      if (!dragFlag) {
        dragFlag = true;
        dragChannel?.postMessage(true);
      }
    },
    true,
  );
  document.addEventListener(
    'dragleave',
    () => {
      if (dragFlag) {
        dragFlag = false;
        dragChannel?.postMessage(false);
      }
    },
    true,
  );
  document.addEventListener(
    'drop',
    () => {
      if (dragFlag) {
        dragFlag = false;
        dragChannel?.postMessage(false);
      }
    },
    true,
  );
}

function resetDraggedOver(): void {
  ensureDragTracker();
  if (dragFlag) {
    dragFlag = false;
    dragChannel?.postMessage(false);
  }
}

function isWindowDraggedOver(): boolean {
  return dragFlag;
}

function sweepStalePayloads() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(TRANSFER_KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as TransferPayload;
        if (typeof parsed.at !== 'number' || Date.now() - parsed.at > TRANSFER_TTL_MS) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

function writePayload(token: string, def: TransferPayload['def']) {
  sweepStalePayloads();
  try {
    const payload: TransferPayload = { def, at: Date.now() };
    localStorage.setItem(TRANSFER_KEY_PREFIX + token, JSON.stringify(payload));
  } catch {}
}

function readPayload(token: string): TransferPayload | null {
  sweepStalePayloads();
  try {
    const raw = localStorage.getItem(TRANSFER_KEY_PREFIX + token);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TransferPayload;
    if (!parsed?.def?.content) return null;
    return parsed;
  } catch {
    return null;
  }
}

function removePayload(token: string) {
  try {
    localStorage.removeItem(TRANSFER_KEY_PREFIX + token);
  } catch {}
}

function snapshotDef(def: WorkspaceTabDef): TransferPayload['def'] | null {
  if (!def.content || def.content === BLANK_CONTENT) return null;
  try {
    return JSON.parse(
      JSON.stringify({
        id: def.id,
        label: def.label,
        icon: def.icon,
        closeable: def.closeable,
        content: def.content,
        props: def.props,
      }),
    );
  } catch {
    return null;
  }
}

function pointOutsideWindow(e: DragEvent): boolean {
  const left = window.screenX;
  const top = window.screenY;
  return (
    e.screenX < left ||
    e.screenX > left + window.outerWidth ||
    e.screenY < top ||
    e.screenY > top + window.outerHeight
  );
}

function clampToNearbyScreen(x: number, y: number): { x: number; y: number } {
  const s = window.screen as Screen & { availLeft?: number; availTop?: number };
  const sl = s.availLeft ?? 0;
  const st = s.availTop ?? 0;
  const inX = x >= sl - 60 && x <= sl + s.availWidth + 60;
  const inY = y >= st - 60 && y <= st + s.availHeight + 60;
  if (!inX || !inY) return { x, y };
  return {
    x: Math.min(Math.max(x, sl), sl + s.availWidth),
    y: Math.min(Math.max(y, st), st + s.availHeight),
  };
}

function transferToken(e: DragEvent): string {
  return e.dataTransfer?.getData(TAB_TRANSFER_TYPE) ?? '';
}

function firstTileId(api: WorkspaceApi): string {
  for (const root of api.roots) {
    let node = root.node;
    while (node.kind === 'split') node = node.dir === 'row' ? node.children[0] : node.children[1];
    return node.kind === 'tile' ? node.id : '';
  }
  return '';
}

function auxUrl(token: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('aux', '1');
  url.searchParams.set('transfer', token);
  url.hash = '';
  return url.href;
}

function openAuxWindow(token: string, screenX: number, screenY: number): Window | null {
  const w = Math.min(1280, Math.max(520, Math.round(window.innerWidth * 0.7)));
  const h = Math.min(900, Math.max(360, Math.round(window.innerHeight * 0.7)));
  const point = clampToNearbyScreen(Math.round(screenX - w * 0.3), screenY - 24);
  const win = window.open(
    auxUrl(token),
    '_blank',
    `popup=yes,width=${w},height=${h},left=${point.x},top=${Math.max(0, point.y)}`,
  );
  if (win) win.opener = null;
  return win;
}

let bannerEl: HTMLElement | null = null;

function hideBlockedBanner() {
  bannerEl?.remove();
  bannerEl = null;
}

function showBlockedBanner(retry: () => void) {
  hideBlockedBanner();
  const el = document.createElement('div');
  el.className = 'sf-aux-blocked';
  const label = document.createElement('span');
  label.textContent = 'Popup blocked — the tab stays here.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Open in new window';
  btn.addEventListener('click', () => {
    hideBlockedBanner();
    retry();
  });
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.title = 'Dismiss';
  close.addEventListener('click', hideBlockedBanner);
  el.append(label, btn, close);
  el.style.cssText =
    'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;display:flex;' +
    'gap:10px;align-items:center;padding:8px 12px;border-radius:8px;background:#252526;color:#ccc;' +
    'border:1px solid #454545;font:12px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  btn.style.cssText =
    'cursor:pointer;padding:3px 10px;border-radius:5px;border:1px solid #0e639c;background:#0e639c;color:#fff;font:inherit';
  close.style.cssText =
    'cursor:pointer;padding:3px 7px;border-radius:5px;border:1px solid #454545;background:transparent;color:#ccc;font:inherit';
  document.body.appendChild(el);
  bannerEl = el;
}

export function createAuxBridge(options: {
  api: WorkspaceApi;
  mode: AuxWindowMode;
  onTransferred?: () => void;
}): AuxBridge {
  const { api, mode, onTransferred } = options;
  const channel = new BroadcastChannel(CLAIM_CHANNEL_PREFIX + location.pathname);
  const pending = new Map<string, PendingTransfer>();
  let currentDragToken: string | null = null;

  ensureDragTracker();

  function dropPending(token: string) {
    const entry = pending.get(token);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    pending.delete(token);
  }

  function armClaimWatch(token: string, tabId: string) {
    if (pending.has(token)) return;
    const timer = setTimeout(() => {
      if (!pending.has(token)) return;
      dropPending(token);
      removePayload(token);
      hideBlockedBanner();
    }, CLAIM_TIMEOUT_MS);
    pending.set(token, { token, tabId, timer });
  }

  function freshDef(base: TransferPayload['def']): WorkspaceTabDef {
    return { ...base, id: `auxtab-${rid()}` };
  }

  function claimIntoWorkspace(payload: TransferPayload, target: ExternalDropTarget | null): boolean {
    const def = freshDef(payload.def);
    if (target?.tileId) {
      if (target.zone === 'center') {
        api.ops.insertTab(target.tileId, target.index, def);
      } else {
        const dir = target.zone === 'left' || target.zone === 'right' ? 'row' : 'column';
        const side = target.zone === 'left' || target.zone === 'top' ? 'start' : 'end';
        api.ops.splitOpen(target.tileId, dir, side, def);
      }
    } else {
      const tileId = firstTileId(api);
      if (!tileId) return false;
      api.ops.openTab(tileId, def);
    }
    onTransferred?.();
    return true;
  }

  function cleanupTransfer(token: string) {
    dropPending(token);
    removePayload(token);
    hideBlockedBanner();
  }

  function onChannelMessage(msg: MessageEvent) {
    const data = msg.data as { kind?: string; token?: string; from?: string } | null;
    if (data?.kind !== 'sf-aux-claim' || typeof data.token !== 'string') return;
    const entry = pending.get(data.token);
    if (!entry) return;
    cleanupTransfer(data.token);
    if (api.dnd.dragging && api.dnd.tabId === entry.tabId) api.endDrag();
    if (api.tabDefs[entry.tabId]) api.ops.closeTab(entry.tabId);
  }

  channel.addEventListener('message', onChannelMessage);

  const bridge: AuxBridge = {
    mode,
    onTabDragStart(e, tabId) {
      currentDragToken = null;
      resetDraggedOver();
      const def = api.tabDefs[tabId];
      const snap = def ? snapshotDef(def) : null;
      if (!snap) return;
      const token = rid();
      writePayload(token, snap);
      e.dataTransfer?.setData(TAB_TRANSFER_TYPE, token);
      e.dataTransfer?.setData('text/plain', tabId);
      armClaimWatch(token, tabId);
      currentDragToken = token;
    },
    onTabDragEnd(e, tabId) {
      const token = currentDragToken;
      currentDragToken = null;
      if (!token) return;
      const entry = pending.get(token);
      if (!entry || entry.tabId !== tabId) return;
      const effect = e.dataTransfer?.dropEffect;
      if (effect !== 'none' && effect !== undefined) return;
      if (!pointOutsideWindow(e) || isWindowDraggedOver()) {
        cleanupTransfer(token);
        return;
      }
      const win = openAuxWindow(token, e.screenX, e.screenY);
      if (!win) {
        showBlockedBanner(() => {
          const retryWin = openAuxWindow(token, e.screenX, e.screenY);
          if (!retryWin) showBlockedBanner(() => {});
        });
        return;
      }
      armClaimWatch(token, tabId);
    },
    onInternalDrop(tabId?: string) {
      for (const [token, entry] of [...pending.entries()]) {
        if (tabId !== undefined && entry.tabId !== tabId) continue;
        cleanupTransfer(token);
      }
    },
    onTransferDrop(e, target) {
      const token = transferToken(e);
      if (!token) return;
      const payload = readPayload(token);
      if (!payload) return;
      if (!claimIntoWorkspace(payload, target)) return;
      removePayload(token);
      channel.postMessage({ kind: 'sf-aux-claim', token, from: windowId() });
    },
    claimPendingFromUrl(): AuxClaimResult {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('transfer');
      url.searchParams.delete('transfer');
      window.history.replaceState(null, '', url.href);
      if (!token) return 'no-token';
      const payload = readPayload(token);
      if (!payload) return 'stale';
      const ok = claimIntoWorkspace(payload, null);
      if (!ok) return 'stale';
      removePayload(token);
      channel.postMessage({ kind: 'sf-aux-claim', token, from: windowId() });
      return 'claimed';
    },
    dispose() {
      channel.removeEventListener('message', onChannelMessage);
      channel.close();
      for (const [, entry] of pending) {
        if (entry.timer) clearTimeout(entry.timer);
      }
      pending.clear();
      hideBlockedBanner();
    },
  };

  return bridge;
}
