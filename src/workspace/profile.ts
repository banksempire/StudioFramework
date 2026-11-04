import type { WorkspaceSnapshot } from './snapshots.ts';

export const PROFILE_FORMAT = 'sf.workspace-profile';
export const PROFILE_VERSION = 1;

export interface WorkspaceProfile {
  format: typeof PROFILE_FORMAT;
  profileVersion: typeof PROFILE_VERSION;
  app: string;
  capturedAt: number;
  name: string;
  snapshot: WorkspaceSnapshot;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isValidProfileSnapshot(v: unknown): v is WorkspaceSnapshot {
  return isRecord(v) && v.version === 1 && Array.isArray(v.roots);
}

export function parseWorkspaceProfile(raw: unknown): WorkspaceProfile {
  if (!isRecord(raw)) throw new Error('workspace profile must be a JSON object');
  if (raw.format !== PROFILE_FORMAT) throw new Error(`workspace profile format must be "${PROFILE_FORMAT}"`);
  if (raw.profileVersion !== PROFILE_VERSION) {
    throw new Error(`unsupported workspace profile version ${String(raw.profileVersion)}`);
  }
  if (typeof raw.app !== 'string' || raw.app.trim().length === 0) {
    throw new Error('workspace profile must carry the producing app identity');
  }
  if (typeof raw.capturedAt !== 'number' || !Number.isFinite(raw.capturedAt)) {
    throw new Error('workspace profile must carry a capturedAt timestamp');
  }
  if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
    throw new Error('workspace profile must carry a name');
  }
  if (!isValidProfileSnapshot(raw.snapshot)) {
    throw new Error('workspace profile snapshot must be a version 1 layout snapshot');
  }
  return {
    format: PROFILE_FORMAT,
    profileVersion: PROFILE_VERSION,
    app: raw.app,
    capturedAt: raw.capturedAt,
    name: raw.name,
    snapshot: raw.snapshot,
  };
}

export function downloadFileNameFor(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `workspace-${slug || 'profile'}.json`;
}
