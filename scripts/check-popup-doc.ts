import { popupH1Groups, toPanelH1 } from '../src/lib/popupPanel.ts';
import type { PopupDocument } from '../src/types/popup.ts';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function report(name: string, ok: boolean, extra = '') {
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function expectsFailure(name: string, run: () => unknown, pattern: RegExp) {
  try {
    run();
    report(name, false, 'no error thrown');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    report(name, pattern.test(msg), msg);
  }
}

function doc(overrides: Record<string, unknown> = {}): PopupDocument {
  return {
    title: 'Demo',
    h1: [
      {
        id: 'general',
        title: 'General',
        h2: [{ title: 'Identity', fields: [{ key: 'name', type: 'input', label: 'Name' }] }],
      },
    ],
    ...overrides,
  } as PopupDocument;
}

expectsFailure(
  'missing h1 raises',
  () => popupH1Groups({ title: 'Demo' } as PopupDocument),
  /must define h1/,
);
expectsFailure('empty h1 raises', () => popupH1Groups(doc({ h1: [] })), /must define h1/);
expectsFailure(
  'untitled h2 raises',
  () => toPanelH1(popupH1Groups(doc({ h1: [{ id: 'g', title: 'G', h2: [{ fields: [] }] }] }))[0], {}),
  /must define a title/,
);

const mapped = toPanelH1(popupH1Groups(doc())[0], { name: 'x' });
report(
  'a valid document maps to a panel h1 with a form bound to the values',
  mapped.id === 'general' &&
    mapped.h2.length === 1 &&
    mapped.h2[0].title === 'Identity' &&
    mapped.h2[0].isHeightVariable === false &&
    mapped.h2[0].components[0].type === 'form' &&
    mapped.h2[0].components[0].values.name === 'x',
  JSON.stringify(mapped),
);

console.log(`popup-doc: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}
