import { loadLayout } from '../src/layout/loadLayout.ts';

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

function expectsFailure(name: string, json: unknown, pattern: RegExp) {
  try {
    loadLayout(json, 'loader-check');
    report(name, false, 'no error thrown');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    report(name, pattern.test(msg), msg);
  }
}

function panel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    framework: { title: 'loader check' },
    menu: [{ label: 'File' }],
    docker: [
      {
        id: 'app',
        displayName: 'App',
        icon: '📄',
        panel: {
          title: 'P',
          groups: [
            {
              id: 'g1',
              title: 'Group',
              sections: [{ id: 's1', title: 'Section', components: [{ type: 'text', text: 'x' }] }],
            },
          ],
        },
      },
    ],
    workspace: { tabs: [] },
    status: { left: [], right: [] },
    ...overrides,
  };
}

function withDockerPanel(overrides: Record<string, unknown>): Record<string, unknown> {
  const doc = panel();
  const docker = (doc.docker as Record<string, unknown>[])[0] as Record<string, unknown>;
  Object.assign(docker.panel as Record<string, unknown>, overrides);
  return doc;
}

report(
  'shipped framework layout loads',
  (() => {
    try {
      loadLayout(undefined, 'framework.layout.json');
      return true;
    } catch (e) {
      return (e as Error).message;
    }
  })() === true,
);

expectsFailure(
  'panel without groups fails fast (h1 missing)',
  withDockerPanel({ groups: [] }),
  /at least one h1 group/,
);

expectsFailure(
  'panel with a group without sections fails fast (h2 missing)',
  withDockerPanel({ groups: [{ id: 'g1', title: 'Group', sections: [] }] }),
  /at least one h2 section/,
);

expectsFailure(
  'group with only an h3 section fails fast (h2 missing)',
  withDockerPanel({
    groups: [
      {
        id: 'g1',
        title: 'Group',
        sections: [{ id: 's1', title: 'Flat', heading: 3, components: [{ type: 'text', text: 'x' }] }],
      },
    ],
  }),
  /at least one h2 section/,
);

expectsFailure('missing groups key fails fast', withDockerPanel({ groups: undefined }), /groups/);

expectsFailure(
  'h3 with variable height fails fast',
  withDockerPanel({
    groups: [
      {
        id: 'g1',
        title: 'Group',
        sections: [
          {
            id: 's0',
            title: 'Real',
            components: [{ type: 'text', text: 'x' }],
          },
          { id: 's1', title: 'Flat', heading: 3, height: 'variable', components: [] },
        ],
      },
    ],
  }),
  /h3 sections are flat/,
);

report(
  'minimal valid panel (h1 + h2, h3 optional) loads',
  (() => {
    try {
      loadLayout(
        panel({
          docker: [
            {
              id: 'app2',
              displayName: 'App',
              icon: '📄',
              panel: {
                title: 'P',
                groups: [
                  {
                    id: 'g1',
                    title: 'Group',
                    sections: [
                      { id: 's1', title: 'Section', components: [{ type: 'text', text: 'x' }] },
                      {
                        id: 's2',
                        title: 'Flat',
                        heading: 3,
                        components: [{ type: 'text', text: 'y' }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        }),
        'loader-check',
      );
      return true;
    } catch (e) {
      return (e as Error).message;
    }
  })() === true,
);

console.log(`\nLOADER CHECKS: ${passed} passed, ${failed} failed\n`);
for (const f of failures) console.log(f);
if (failed > 0) process.exit(1);
