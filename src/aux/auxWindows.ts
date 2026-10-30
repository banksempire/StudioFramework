import type { InjectionKey } from 'vue';
import {
  BLANK_CONTENT,
  type ExternalDropTarget,
  TAB_TRANSFER_TYPE,
  type WorkspaceApi,
} from '../composables/useWorkspace';
import type { WorkspaceTabDef } from '../types/layout';

const CLAIM_CHANNEL_PREFIX = 'sf.aux.channel.';
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

function channelId(): string {
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

function rid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
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
  const plain: WorkspaceTabDef = JSON.parse(
    JSON.stringify({
      id: def.id,
      label: def.label,
      icon: def.icon,
      closeable: def.closeable,
      content: def.content,
      props: def.props,
    }),
  );
  return plain;
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

export function createAuxBridge(options: { api: WorkspaceApi; mode: AuxWindowMode }): AuxBridge {
  const { api, mode } = options;
  const channel = new BroadcastChannel(CLAIM_CHANNEL_PREFIX + location.pathname);
  const pending = new Map<string, PendingTransfer>();
  let currentDragToken: string | null = null;

  function onClaim(msg: MessageEvent) {
    const data = msg.data as { kind?: string; token?: string } | null;
    if (data?.kind !== 'sf-aux-claim' || typeof data.token !== 'string') return;
    const entry = pending.get(data.token);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    pending.delete(data.token);
    removePayload(data.token);
    if (api.tabDefs[entry.tabId]) api.ops.closeTab(entry.tabId);
  }

  channel.addEventListener('message', onClaim);

  function armClaimWatch(token: string, tabId: string) {
    if (pending.has(token)) return;
    const timer = setTimeout(() => {
      const entry = pending.get(token);
      if (entry) {
        pending.delete(token);
        removePayload(token);
      }
    }, CLAIM_TIMEOUT_MS);
    pending.set(token, { token, tabId, timer });
  }

  function freshDef(base: TransferPayload['def']): WorkspaceTabDef {
    return { ...base, id: `auxtab-${rid()}` };
  }

  function claimIntoWorkspace(payload: TransferPayload, target: ExternalDropTarget | null) {
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
    return true;
  }

  function tearOut(token: string, tabId: string, screenX: number, screenY: number) {
    const url = new URL(window.location.href);
    url.searchParams.set('aux', '1');
    url.searchParams.set('transfer', token);
    url.hash = '';
    const w = Math.min(1280, Math.max(520, Math.round(window.innerWidth * 0.7)));
    const h = Math.min(900, Math.max(360, Math.round(window.innerHeight * 0.7)));
    const left = Math.max(0, screenX - Math.round(w * 0.3));
    const top = Math.max(0, screenY - 24);
    const win = window.open(url.href, '_blank', `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
    if (!win) {
      removePayload(token);
      return;
    }
    win.opener = null;
    armClaimWatch(token, tabId);
  }

  function dropPending(token: string) {
    const entry = pending.get(token);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    pending.delete(token);
  }

  const bridge: AuxBridge = {
    mode,
    onTabDragStart(e, tabId) {
      currentDragToken = null;
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
      const entry = pending.get(token) ?? null;
      if (!entry || entry.tabId !== tabId) return;
      dropPending(token);
      const effect = e.dataTransfer?.dropEffect;
      if ((effect === 'none' || effect === undefined) && pointOutsideWindow(e)) {
        tearOut(token, tabId, e.screenX, e.screenY);
        return;
      }
      if (effect === 'none' || effect === undefined) {
        removePayload(token);
      }
    },
    onInternalDrop(tabId?: string) {
      for (const [token, entry] of [...pending.entries()]) {
        if (tabId !== undefined && entry.tabId !== tabId) continue;
        if (entry.timer) clearTimeout(entry.timer);
        pending.delete(token);
        removePayload(token);
      }
    },
    onTransferDrop(e, target) {
      const token = transferToken(e);
      if (!token) return;
      const payload = readPayload(token);
      if (!payload) return;
      if (!claimIntoWorkspace(payload, target)) return;
      removePayload(token);
      channel.postMessage({ kind: 'sf-aux-claim', token, from: channelId() });
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
      channel.postMessage({ kind: 'sf-aux-claim', token, from: channelId() });
      return 'claimed';
    },
    dispose() {
      channel.removeEventListener('message', onClaim);
      channel.close();
      for (const [, entry] of pending) {
        if (entry.timer) clearTimeout(entry.timer);
      }
      pending.clear();
    },
  };

  return bridge;
}
