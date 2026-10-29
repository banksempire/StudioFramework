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
          h1: [
            {
              id: 'g1',
              title: 'Group',
              h2: [{ id: 's1', title: 'Section', components: [{ type: 'text', text: 'x' }] }],
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
  withDockerPanel({ h1: [] }),
  /at least one h1 group/,
);

expectsFailure(
  'panel with a group without sections fails fast (h2 missing)',
  withDockerPanel({ h1: [{ id: 'g1', title: 'Group', h2: [] }] }),
  /at least one h2 section/,
);

expectsFailure(
  'group with only an h3 section fails fast (h2 missing)',
  withDockerPanel({
    h1: [
      {
        id: 'g1',
        title: 'Group',
        h2: [{ id: 's1', title: 'Flat', heading: 3, components: [{ type: 'text', text: 'x' }] }],
      },
    ],
  }),
  /level jump/,
);

expectsFailure('missing h1 key fails fast', withDockerPanel({ h1: undefined }), /h1/);

expectsFailure(
  'h3 with variable height fails fast',
  withDockerPanel({
    h1: [
      {
        id: 'g1',
        title: 'Group',
        h2: [
          {
            id: 's0',
            title: 'Real',
            components: [
              { type: 'text', text: 'x' },
              { id: 's1', title: 'Flat', heading: 3, height: 'variable', components: [] },
            ],
          },
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
                h1: [
                  {
                    id: 'g1',
                    title: 'Group',
                    h2: [
                      {
                        id: 's1',
                        title: 'Section',
                        components: [
                          { type: 'text', text: 'x' },
                          { id: 's2', title: 'Flat', heading: 3, components: [{ type: 'text', text: 'y' }] },
                        ],
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

report(
  'h2 section with a string bind loads and carries it through',
  (() => {
    try {
      const layout = panel({
        docker: [
          {
            id: 'app-bind',
            displayName: 'App',
            icon: '📄',
            panel: {
              title: 'P',
              h1: [
                {
                  id: 'g1',
                  title: 'Group',
                  h2: [
                    {
                      id: 's1',
                      title: 'Conditional',
                      bind: 'some-state',
                      components: [{ type: 'text', text: 'x' }],
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
      const h2 = loadLayout(layout, 'loader-check').docker[0].panel.h1[0].h2[0];
      return h2.bind === 'some-state';
    } catch (e) {
      return (e as Error).message;
    }
  })() === true,
);

expectsFailure(
  'h2 bind must be a string',
  panel({
    docker: [
      {
        id: 'app-bind-bad',
        displayName: 'App',
        icon: '📄',
        panel: {
          title: 'P',
          h1: [
            {
              id: 'g1',
              title: 'Group',
              h2: [{ id: 's1', title: 'Bad', bind: 7, components: [{ type: 'text', text: 'x' }] }],
            },
          ],
        },
      },
    ],
  }),
  /expected a string/,
);

console.log(`\nLOADER CHECKS: ${passed} passed, ${failed} failed\n`);
for (const f of failures) console.log(f);
if (failed > 0) process.exit(1);
