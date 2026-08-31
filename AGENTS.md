# StudioFramework — framework manual

Task-specific manual for the StudioFramework repo. The workspace-level contract (ground rules, workflow, ports) lives in [`../AGENTS.md`](../AGENTS.md) — it always applies.

## Role and constraints

- VSCode-like IDE shell for Vue 3 + TypeScript, fully data-driven: the entire UI (menu bar, docker, panels, workspace, status bar) is defined by a single JSON layout file loaded at startup.
- **Must remain framework-generic** — no pi-agent-specific code. All product-specific content lives in `pi-agent-studio/src/pi-studio/layout/app.layout.json` + its components. If the framework is missing a feature, add it here and keep the demo + test suites green.
- The product consumes this source directly via the `@sf` vite alias — one dev server, HMR across both repos.

## Dev server & ports

- `npm run dev` binds **7493** — the shared workspace test port — so it runs alongside the product on 7492 without taking it over. If 7493 is taken (e.g. the review instance's web), start it on a private port (`npm run dev -- --port 75xx`) and run checks with `SF_TEST_PORT=75xx`.
- Check scripts target whatever serves on `SF_TEST_PORT` (default 7493). **Always run checks against a server you started yourself** — pointed at the default while something else owns 7493, the suites silently test that other server.

## Scripts

- `npm run dev` — Vite dev server (7493 by default)
- `npm run build` — `vue-tsc --noEmit && vite build`
- `npm run typecheck` — `vue-tsc --noEmit` (plain `tsc` does NOT check `.vue` files)
- `npm run check` / `check:dtt` / `check:utils` / `check:autohide` / `check:mobile` / `check:tabfit` / `check:ws` — Playwright headless suites (all honor `SF_TEST_PORT`, default 7493)
- `npm run check:tree` — Node unit tests for the workspace split-tree (44 assertions)
- Full list in `package.json`.

## Layout file

`src/layout/framework.layout.json` is loaded at startup; `doc/framework.layout.json` is a static review copy, **NOT** loaded.

## Terminology (used across both repos)

"panel" not "sidebar"; "RightPanel" not "PropertyPanel"; Workspace = central box; Tile = split-tree node; Tab = items in a tile; the whole UI shell = the **"framework"** (not "app"); each icon on the Docker bar = an **"app"** (not "tag" / "docker icon").

## Icons

Icon additions to `SvgIcon.vue` are generic even when motivated by the product (e.g. `sort` + `⏰` were added for the scheduler UI). Docker icons must fill the 24×24 viewBox (~18+ units, centered) — enforced by geometry assertions (`check:dockericons` in pi-agent-studio, `check:utils` here).

## Processes & commits

- Killing vite: avoid `pkill -f vite` (matches your own shell) — kill by PID from `/proc`.
- Auto-commit completed work with clear, descriptive messages (typecheck before committing when feasible). Don't commit half-finished work or test scaffolding.
