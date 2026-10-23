# StudioFramework — framework manual

Task-specific manual. The workspace contract (ground rules, workflow, ports) lives in [`../agents.md`](../agents.md) and always applies. When this manual disagrees with the code, the code wins.

## Role and constraints

- VSCode-like IDE shell for Vue 3 + TypeScript, fully data-driven: the entire UI (menu bar, docker, panels, workspace, status bar) is defined by a single JSON layout file loaded at startup.
- **Must remain framework-generic** — no pi-agent-specific code. All product-specific content lives in `pi-agent-studio/src/pi-studio/layout/app.layout.json` + its providers. If the framework is missing a feature, add it here and keep the demo + test suites green. Any change must also be verified against `pi-agent-studio` (typecheck + relevant suites) before reporting done.
- **Declarative panel library**: panel components are `text | input | button | tree | keyValueList | list | form | header | banner | table | menuButton | component`. Every type accepts `bind` — a key registered via `registerPanelData(key, getter)` whose reactive value supplies the content (viewmodel); user gestures funnel to the app as panel actions (framework emits, app handles). The `component` escape hatch remains for genuinely custom surfaces.
- The product consumes this source directly via the `@sf` vite alias (consumer-side) — one dev server, HMR across both repos.

## Dev server & ports

- `npm run dev` binds **7493** — the shared workspace test port (in-container only; the container exposes only 17000-17019 for product webs). If 7493 is taken, start on a private port outside that range (`npm run dev -- --port 75xx`) and run checks with `SF_TEST_PORT=75xx`.
- Check scripts target whatever serves on `SF_TEST_PORT` (default 7493). **Always run checks against a server you started yourself** — pointed at the default while something else owns 7493, the suites silently test that other server.

## Scripts

- `npm run dev` — Vite dev server (7493 by default)
- `npm run typecheck` — `vue-tsc --noEmit` (plain `tsc` does NOT check `.vue` files)
- `npm run build` — `vue-tsc --noEmit && vite build`
- `npm run check` / `check:*` — Playwright headless suites, all honoring `SF_TEST_PORT`; `check:tree` is Node-only unit tests for the workspace split-tree; `check:utils` includes icon geometry assertions. Full list in `package.json`.

## Layout file

`src/layout/framework.layout.json` is loaded at startup; `doc/framework.layout.json` is a static review copy, **NOT** loaded.

### Section hierarchy rules (enforced by the loader, fail-quick at startup)

- Exactly three header levels: H1 groups own H2 sections; H3 sections nest **inside their owning H2's** `components` array (mixed with leaf components, rendered in array order). There is no flat H3-after-H2 form.
- `h1` groups carry `h2` sections only — a `heading: 3` entry at the h1 level is a level jump and fails the load.
- `components: []` is illegal for H2 and H3 alike; every section carries at least one entry (leaf or nested H3).
- An H3 declares `heading: 3`, may not set `height`, and cannot contain further sections. H2 `heading` is always 2.
- Every panel has at least one H1; every H1 has at least one H2.
- Popups follow the same shape one level shallower: `PopupH2.fields` plus an optional `h3: PopupH3[]` nesting list — there is no heading flag.

## Terminology (used across both repos)

"panel" not "sidebar"; "RightPanel" not "PropertyPanel"; Workspace = central box; Tile = split-tree node; Tab = items in a tile; the whole UI shell = the **"framework"** (not "app"); each icon on the Docker bar = an **"app"** (not "tag" / "docker icon").

## Icons

Icon additions go to `SvgIcon.vue` and stay generic even when motivated by a product (e.g. `sort` + `⏰` were added for scheduler UIs). Geometry conventions are enforced by suites: this repo's `check:utils` asserts a demo util icon fills the 24×24 viewBox (≥18 wide, ≥16 tall, centered); docker-icon geometry is asserted by pi-agent-studio's `check:dockericons`.

## Processes & commits

- Killing vite: never `pkill -f vite` (workspace rule) — kill by PID.
- Commit completed work with clear, descriptive messages; don't commit half-finished work or test scaffolding. Workspace git rules apply: dev work only on `.branch/*` worktrees, never on the main checkouts.
