const CHANNEL_NAME = 'sf.window-dragged-over';

interface DragTrackingMessage {
  type: 'over' | 'reset';
  id?: number;
  over?: boolean;
}

const states = new Map<number, boolean>();
let channel: BroadcastChannel | null = null;

function broadcast(message: DragTrackingMessage) {
  try {
    channel?.postMessage(message);
  } catch {}
}

function setOver(windowId: number, over: boolean) {
  if (!states.has(windowId)) return;
  states.set(windowId, over);
  broadcast({ type: 'over', id: windowId, over });
}

function handleMessage(message: DragTrackingMessage) {
  if (message.type === 'reset') {
    for (const id of [...states.keys()]) states.set(id, false);
    return;
  }
  if (message.type === 'over' && typeof message.id === 'number') {
    states.set(message.id, !!message.over);
  }
}

export function registerWindowForDragTracking(win: Window, windowId: number): void {
  if (states.has(windowId)) return;
  states.set(windowId, false);
  try {
    channel ??= new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<DragTrackingMessage>) => handleMessage(event.data);
  } catch {
    channel = null;
  }
  win.addEventListener(
    'dragover',
    () => {
      setOver(windowId, true);
    },
    true,
  );
  win.addEventListener(
    'dragleave',
    () => {
      setOver(windowId, false);
    },
    true,
  );
  win.addEventListener(
    'drop',
    () => {
      setOver(windowId, false);
    },
    true,
  );
}

export function isAnyWindowDraggedOver(): boolean {
  for (const over of states.values()) {
    if (over) return true;
  }
  return false;
}

export function resetWindowDragTracking(): void {
  broadcast({ type: 'reset' });
  for (const id of [...states.keys()]) states.set(id, false);
}
