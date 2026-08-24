const STORAGE_KEY = 'sf.ui.state';
const STATE_VERSION = 1;
const FLUSH_DELAY_MS = 300;

interface UiStateFile {
  version: number;
  values: Record<string, unknown>;
}

let values: Record<string, unknown> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

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

export function writeUiValue(key: string, value: unknown): void {
  loadValues()[key] = value;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush);
}
