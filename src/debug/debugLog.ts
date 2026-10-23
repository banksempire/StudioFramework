import { shallowRef } from 'vue';

export type DebugLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DebugLogEntry {
  id: number;
  time: number;
  level: DebugLogLevel;
  message: string;
}

const MAX_ENTRIES = 2000;

const LEVEL_RANK: Record<DebugLogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const CAPTURED: Array<{ method: string; level: DebugLogLevel }> = [
  { method: 'debug', level: 'debug' },
  { method: 'log', level: 'info' },
  { method: 'info', level: 'info' },
  { method: 'warn', level: 'warn' },
  { method: 'error', level: 'error' },
];

export const debugLogs = shallowRef<DebugLogEntry[]>([]);

let nextId = 0;
let installed = false;

export function isDebugMode(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
}

export function levelRank(level: DebugLogLevel): number {
  return LEVEL_RANK[level];
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function formatLogTime(time: number): string {
  const d = new Date(time);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  if (typeof arg === 'object' && arg !== null) {
    try {
      const json = JSON.stringify(arg);
      if (json !== undefined) return json;
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

export function formatArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}

export function formatEntryText(entry: DebugLogEntry): string {
  return `[${formatLogTime(entry.time)}] [${entry.level.toUpperCase()}] ${entry.message}`;
}

function push(level: DebugLogLevel, args: unknown[]): void {
  const entry: DebugLogEntry = {
    id: nextId,
    time: Date.now(),
    level,
    message: formatArgs(args),
  };
  nextId += 1;
  const current = debugLogs.value;
  const next =
    current.length >= MAX_ENTRIES
      ? [...current.slice(current.length - MAX_ENTRIES + 1), entry]
      : [...current, entry];
  debugLogs.value = next;
}

export function clearDebugLogs(): void {
  debugLogs.value = [];
}

export function installDebugLogCapture(): boolean {
  if (installed || !isDebugMode()) return false;
  installed = true;

  for (const { method, level } of CAPTURED) {
    const original = (console[method as keyof Console] as (...args: unknown[]) => void).bind(console);
    (console as unknown as Record<string, (...args: unknown[]) => void>)[method] = (...args: unknown[]) => {
      push(level, args);
      original(...args);
    };
  }

  window.addEventListener('error', (event) => {
    if (event.error instanceof Error) {
      push('error', [event.error]);
      return;
    }
    push('error', [`${event.message} (${event.filename}:${event.lineno}:${event.colno})`]);
  });
  window.addEventListener('unhandledrejection', (event) => {
    push('error', [`unhandled rejection: ${formatArg(event.reason)}`]);
  });

  push('info', ['debug log capture installed (?debug mode)']);
  return true;
}
