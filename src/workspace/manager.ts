import { ref } from 'vue';
import type { WorkspaceApi } from '../composables/useWorkspace';
import { downloadTextFile, pickJsonFile } from '../lib/fileTransfer';
import { registerPanelData } from '../registry';
import type { PanelListItem } from '../types/panel';
import { downloadFileNameFor, PROFILE_FORMAT, PROFILE_VERSION, parseWorkspaceProfile } from './profile';
import type { NodeSnapshot, WorkspaceSnapshot } from './snapshots';

export const WORKSPACE_ITEM_ACTION = 'sf-workspace';
export const WORKSPACE_SAVE_UTILITY = 'sf-save-workspace';
export const WORKSPACE_IMPORT_UTILITY = 'sf-import-workspace';
export const WORKSPACE_LIST_BIND = 'workspace-list';
export const WORKSPACE_BANNER_BIND = 'workspace-banner';

export interface WorkspaceMeta {
  id: string;
  name: string;
  savedAt: number;
  tiles: number;
  tabs: number;
  windows: number;
}

export interface WorkspaceRecord extends WorkspaceMeta {
  snapshot: WorkspaceSnapshot;
}

export interface WorkspaceStorage {
  list(): Promise<WorkspaceMeta[]>;
  load(id: string): Promise<WorkspaceSnapshot>;
  save(name: string, snapshot: WorkspaceSnapshot): Promise<WorkspaceMeta>;
  update(id: string, patch: { name?: string; snapshot?: WorkspaceSnapshot }): Promise<WorkspaceMeta>;
  delete(id: string): Promise<void>;
}

export function snapshotSummary(snap: WorkspaceSnapshot): { tiles: number; tabs: number; windows: number } {
  let tiles = 0;
  let tabs = 0;
  const walk = (node: NodeSnapshot): void => {
    if (node.kind === 'tile') {
      tiles += 1;
      tabs += node.tabs.length;
      return;
    }
    walk(node.children[0]);
    walk(node.children[1]);
  };
  for (const root of snap.roots ?? []) walk(root.node);
  let windows = 0;
  for (const aux of snap.auxWindows ?? []) {
    windows += 1;
    for (const root of aux.roots) walk(root.node);
  }
  return { tiles, tabs, windows };
}

interface StoredRecord {
  id: string;
  name: string;
  savedAt: number;
  snapshot: WorkspaceSnapshot;
}

const LOCAL_KEY = 'sf.workspaces';

function localLoadAll(): StoredRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function localPersist(records: StoredRecord[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  } catch {}
}

function localMeta(r: StoredRecord): WorkspaceMeta {
  return { id: r.id, name: r.name, savedAt: r.savedAt, ...snapshotSummary(r.snapshot) };
}

function newLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const localWorkspaceStorage: WorkspaceStorage = {
  async list() {
    return localLoadAll()
      .map(localMeta)
      .sort((a, b) => b.savedAt - a.savedAt);
  },
  async load(id) {
    const r = localLoadAll().find((e) => e.id === id);
    if (!r) throw new Error('workspace not found');
    return r.snapshot;
  },
  async save(name, snapshot) {
    const rec: StoredRecord = { id: newLocalId(), name, savedAt: Date.now(), snapshot };
    const all = localLoadAll();
    all.unshift(rec);
    localPersist(all);
    return localMeta(rec);
  },
  async update(id, patch) {
    const all = localLoadAll();
    const i = all.findIndex((e) => e.id === id);
    if (i < 0) throw new Error('workspace not found');
    const prev = all[i];
    const next: StoredRecord = {
      ...prev,
      name: patch.name !== undefined ? patch.name : prev.name,
      snapshot: patch.snapshot !== undefined ? patch.snapshot : prev.snapshot,
      savedAt: patch.snapshot !== undefined ? Date.now() : prev.savedAt,
    };
    all[i] = next;
    localPersist(all);
    return localMeta(next);
  },
  async delete(id) {
    localPersist(localLoadAll().filter((e) => e.id !== id));
  },
};

let storage: WorkspaceStorage = localWorkspaceStorage;

export function registerWorkspaceStorage(next: WorkspaceStorage | null): void {
  storage = next ?? localWorkspaceStorage;
  refreshSeq += 1;
  listEverLoaded = false;
  metas.value = [];
}

export function workspaceStorage(): WorkspaceStorage {
  return storage;
}

const metas = ref<WorkspaceMeta[]>([]);
const activeId = ref('');
const notice = ref<{ text: string; tone: 'info' | 'error' } | null>(null);

let refreshSeq = 0;
let listEverLoaded = false;

async function refreshWorkspaces(): Promise<void> {
  const seq = ++refreshSeq;
  try {
    const list = await storage.list();
    if (seq === refreshSeq) {
      metas.value = list;
      listEverLoaded = true;
    }
  } catch (e) {
    if (seq === refreshSeq) {
      notice.value = { text: `Could not load workspaces: ${errMsg(e)}`, tone: 'error' };
    }
  }
}

let boundApi: WorkspaceApi | null = null;
let profileIdentity = 'unknown';

export function registerWorkspaceProfileIdentity(app: string): void {
  profileIdentity = app.trim() || 'unknown';
}

export function bindWorkspaceManager(api: WorkspaceApi | null): void {
  boundApi = api;
  activeId.value = '';
  notice.value = null;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function summaryText(m: WorkspaceMeta): string {
  const parts = [plural(m.tabs, 'tab'), plural(m.tiles, 'tile')];
  if (m.windows > 0) parts.push(plural(m.windows, 'window'));
  return parts.join(' · ');
}

function autoName(): string {
  let max = 0;
  for (const m of metas.value) {
    const match = /(\d+)\s*$/.exec(m.name);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `Workspace ${max + 1}`;
}

function metaOf(id: string): WorkspaceMeta | undefined {
  return metas.value.find((m) => m.id === id);
}

export async function saveCurrentWorkspace(): Promise<void> {
  if (!boundApi) return;
  try {
    await storage.save(autoName(), boundApi.capture());
    await refreshWorkspaces();
  } catch (e) {
    notice.value = { text: `Could not save workspace: ${errMsg(e)}`, tone: 'error' };
  }
}

export async function loadWorkspace(id: string): Promise<void> {
  if (!boundApi) return;
  const name = metaOf(id)?.name ?? id;
  try {
    const snap = await storage.load(id);
    const ghosts = boundApi.apply(snap);
    activeId.value = id;
    notice.value =
      ghosts.length > 0
        ? { text: `${plural(ghosts.length, 'unavailable window')} — shown blank`, tone: 'info' }
        : null;
  } catch (e) {
    notice.value = { text: `Could not load "${name}" (${errMsg(e)})`, tone: 'error' };
  }
}

export async function overwriteWorkspace(id: string): Promise<void> {
  if (!boundApi) return;
  const name = metaOf(id)?.name ?? id;
  try {
    await storage.update(id, { snapshot: boundApi.capture() });
    activeId.value = id;
    await refreshWorkspaces();
  } catch (e) {
    notice.value = { text: `Could not update "${name}": ${errMsg(e)}`, tone: 'error' };
  }
}

export async function renameWorkspace(id: string, name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  try {
    await storage.update(id, { name: trimmed });
    await refreshWorkspaces();
    return true;
  } catch (e) {
    notice.value = { text: `Could not rename workspace: ${errMsg(e)}`, tone: 'error' };
    return false;
  }
}

export async function deleteWorkspace(id: string): Promise<void> {
  try {
    await storage.delete(id);
    if (activeId.value === id) activeId.value = '';
    await refreshWorkspaces();
  } catch (e) {
    notice.value = { text: `Could not delete workspace: ${errMsg(e)}`, tone: 'error' };
  }
}

export interface WorkspaceConfirmRequest {
  kind: 'delete' | 'overwrite';
  id: string;
  name: string;
}

export interface WorkspaceActionOutcome {
  handled: boolean;
  rename?: { id: string; name: string };
  confirm?: WorkspaceConfirmRequest;
}

interface ItemActionPayload {
  gesture?: string;
  id?: string;
  option?: string;
  button?: string;
  x?: number;
  y?: number;
  openMenu?: (x: number, y: number) => void;
}

export function handleWorkspaceItemAction(payload: unknown): WorkspaceActionOutcome {
  const p = (payload ?? {}) as ItemActionPayload;
  if (typeof p.id !== 'string') return { handled: false };
  if (p.gesture === 'activate') {
    void loadWorkspace(p.id);
    return { handled: true };
  }
  if (p.gesture === 'button' && p.button === 'more' && typeof p.openMenu === 'function') {
    p.openMenu(p.x ?? 0, p.y ?? 0);
    return { handled: true };
  }
  if (p.gesture === 'menu' && typeof p.option === 'string') {
    if (p.option === 'load') {
      void loadWorkspace(p.id);
      return { handled: true };
    }
    if (p.option === 'overwrite') {
      const m = metaOf(p.id);
      return m
        ? { handled: true, confirm: { kind: 'overwrite', id: p.id, name: m.name } }
        : { handled: true };
    }
    if (p.option === 'rename') {
      const m = metaOf(p.id);
      return m ? { handled: true, rename: { id: p.id, name: m.name } } : { handled: true };
    }
    if (p.option === 'export') {
      void exportWorkspaceToFile(p.id);
      return { handled: true };
    }
    if (p.option === 'delete') {
      const m = metaOf(p.id);
      return m ? { handled: true, confirm: { kind: 'delete', id: p.id, name: m.name } } : { handled: true };
    }
  }
  return { handled: false };
}

function uniqueImportName(base: string): string {
  const taken = new Set(metas.value.map((m) => m.name));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function exportWorkspaceToFile(id: string): Promise<void> {
  const name = metaOf(id)?.name ?? 'workspace';
  try {
    const snapshot = await storage.load(id);
    downloadTextFile(
      downloadFileNameFor(name),
      JSON.stringify(
        {
          format: PROFILE_FORMAT,
          profileVersion: PROFILE_VERSION,
          app: profileIdentity,
          capturedAt: Date.now(),
          name,
          snapshot,
        },
        null,
        2,
      ),
    );
    notice.value = { text: `Exported "${name}" to ${downloadFileNameFor(name)}`, tone: 'info' };
  } catch (e) {
    notice.value = { text: `Could not export "${name}": ${errMsg(e)}`, tone: 'error' };
  }
}

export async function importWorkspaceFromFile(): Promise<void> {
  let file: File | null = null;
  try {
    file = await pickJsonFile();
  } catch {
    file = null;
  }
  if (!file) return;
  try {
    const text = await file.text();
    if (text.length > 20_000_000) throw new Error('file is too large');
    const profile = parseWorkspaceProfile(JSON.parse(text));
    const name = uniqueImportName(profile.name);
    const meta = await storage.save(name, profile.snapshot);
    await refreshWorkspaces();
    await loadWorkspace(meta.id);
    notice.value = {
      text: `Imported "${name}" (from ${profile.app}) — loading it now`,
      tone: 'info',
    };
  } catch (e) {
    notice.value = { text: `Could not import workspace: ${errMsg(e)}`, tone: 'error' };
  }
}

export function handleWorkspaceImportUtility(): boolean {
  if (!boundApi) return false;
  void importWorkspaceFromFile();
  return true;
}

export function handleWorkspaceSaveUtility(): boolean {
  if (!boundApi) return false;
  void saveCurrentWorkspace();
  return true;
}

function workspaceItems(): PanelListItem[] {
  return metas.value.map((m) => ({
    id: m.id,
    label: m.name,
    meta: timeAgo(m.savedAt),
    detail: summaryText(m),
    title: `Load workspace: ${m.name}`,
    active: m.id === activeId.value,
    action: WORKSPACE_ITEM_ACTION,
    options: [
      { id: 'load', label: 'Load', icon: '▶' },
      { id: 'overwrite', label: 'Overwrite with current', icon: '↻' },
      { id: 'rename', label: 'Rename', icon: '✎' },
      { id: 'export', label: 'Export to file', icon: '↑' },
      { id: 'delete', label: 'Delete', icon: '🗑', danger: true },
    ],
    buttons: [{ id: 'more', icon: '⋮', title: 'More', visibility: 'mobile' }],
  }));
}

registerPanelData(WORKSPACE_LIST_BIND, () => {
  if (!listEverLoaded) void refreshWorkspaces();
  return {
    items: workspaceItems(),
    empty: 'No saved workspaces yet — save the current layout with Save above.',
  };
});

registerPanelData(WORKSPACE_BANNER_BIND, () => notice.value ?? {});
