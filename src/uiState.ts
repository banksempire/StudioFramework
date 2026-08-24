import { ref } from 'vue';

const STORAGE_KEY = 'sf.ui.state';
const STATE_VERSION = 1;
const FLUSH_DELAY_MS = 300;

interface UiStateFile {
  version: number;
  values: Record<string, unknown>;
}

let values: Record<string, unknown> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const uiEpoch = ref(0);

function loadValues(): Record<string, unknown> {
  if (values) return values;
  values = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return values;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      (parsed as UiStateFile).version === STATE_VERSION &&
      typeof (parsed as UiStateFile).values === 'object' &&
      (parsed as UiStateFile).values !== null
    ) {
      values = (parsed as UiStateFile).values;
    }
  } catch {
    return values;
  }
  return values;
}

function flush() {
  if (!values) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STATE_VERSION, values }));
  } catch {
    return;
  }
}

export function readUiValue(key: string): unknown {
  return loadValues()[key];
}

export function readUiNumber(key: string): number | undefined {
  const v = loadValues()[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function readUiString(key: string): string | undefined {
  const v = loadValues()[key];
  return typeof v === 'string' ? v : undefined;
}

export function readUiStringArray(key: string): string[] | undefined {
  const v = loadValues()[key];
  if (!Array.isArray(v)) return undefined;
  return v.every((item) => typeof item === 'string') ? (v as string[]) : undefined;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

export function writeUiValue(key: string, value: unknown): void {
  loadValues()[key] = value;
  scheduleFlush();
}

export function removeUiValue(key: string): void {
  if (!(key in loadValues())) return;
  delete loadValues()[key];
  scheduleFlush();
}

export function readAllUiValues(): Record<string, unknown> {
  return { ...loadValues() };
}

export function applyUiValues(map: Record<string, unknown>): void {
  const next = loadValues();
  for (const key of Object.keys(next)) delete next[key];
  for (const [key, value] of Object.entries(map)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value)
    ) {
      next[key] = value;
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      try {
        next[key] = JSON.parse(JSON.stringify(value));
      } catch {}
    }
  }
  flush();
  uiEpoch.value += 1;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush);
}
