import Frame from 'node:assert/strict';
import { getPanelComponent, registerBuiltinPanelComponent, registerPanelComponent } from '../src/registry.ts';

Frame.throws(
  () => getPanelComponent('workspace-panel'),
  (e: unknown) => e instanceof Error && e.message.includes('unknown panel component'),
  'the registry starts empty: unknown keys raise',
);

registerBuiltinPanelComponent('guard-demo', {} as never);
Frame.ok(getPanelComponent('guard-demo') !== undefined, 'builtin registration lands in the registry');

Frame.throws(
  () => getPanelComponent('not-registered'),
  (e: unknown) => e instanceof Error && e.message.includes('unknown panel component "not-registered"'),
  'unknown layout component key raises at render',
);

Frame.throws(
  () => registerPanelComponent(),
  (e: unknown) =>
    e instanceof Error &&
    e.message.includes('reserved for framework built-ins') &&
    e.message.includes('guard-demo'),
  'downstream registration raises with the guidance message',
);

console.log('registry guard: all assertions passed');
