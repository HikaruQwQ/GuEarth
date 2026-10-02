# AGENTS.md

Guidance for AI coding agents working in this repository. Read this file before making changes.

## Project

**GuEarth** (`E:\Code\GuEarth`, GitHub: `HikaruQwQ/GuEarth`) is an Electron desktop "digital
earth" for geography education — a local, Google-Earth-style 3D globe with terrain, integrated
map data providers, an AI globe assistant ("EOQ agent"), and teaching/drawing tools.

## Technical Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Shell | Electron + electron-vite | contextIsolation on, nodeIntegration off, typed preload IPC (`window.guEarth`) |
| Renderer | Vue 3 + Pinia + **Ant Design Vue** | UI framework is Ant Design Vue — see [DESIGN.md](./DESIGN.md) |
| Charts | ECharts via `vue-echarts` | modular imports (`echarts/core` + SVGRenderer) wrapped in `src/renderer/src/components/charts/LineChart.vue` |
| 3D / Map | CesiumJS | Static assets (Workers/ThirdParty/Assets/Widgets) served from `cesium/` by the inline plugin in `electron.vite.config.ts`; `CESIUM_BASE_URL=./cesium/`. The renderer CSP must keep `'unsafe-eval'` — Cesium's bundled Knockout calls `eval` at module load, so without it the whole entry module aborts and the window is blank |
| AI | OpenAI-compatible streaming client in the main process | Provider-agnostic (DeepSeek/Qwen/OpenAI…); API keys live **only** in the main process via `safeStorage`, never in the renderer |
| Storage | JSON files in `userData` (`settings.json`, `annotations.json`, `ai-settings.json`) | credentials via `safeStorage` KeyVault; no SQLite yet |
| Packaging | electron-builder | Windows NSIS first |

**Pinned versions — do not bump casually:**

- `vite@^7` — electron-vite@5 peer range tops out at vite 7.
- `typescript@5.9.x` — TypeScript 7 (native) is incompatible with vue-tsc.
- `ant-design-vue@4.x` is the latest Vue port (4.2.6); the React antd line is at v6. The Vue port
  implements the same Ant Design token system — follow [DESIGN.md](./DESIGN.md) tokens, not the
  React v6 API.
- Electron binaries must be installed manually with the npmmirror mirror:
  `ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/electron/install.js`
  (otherwise `npm run dev` fails with "Electron uninstall").

## Architecture

```
src/main/       Main process: window, KeyVault, AI proxy (streaming), tile cache, SQLite
src/preload/    contextBridge API + type declarations
src/renderer/   Vue app: globe view, layer registry, drawing tools, EOQ assistant UI
```

- The renderer never touches Node APIs or secrets. All privileged work goes through IPC.
- EOQ agent loop: renderer chat → main-process LLM call → model tool calls (flyTo / queryTerrain
  / addLayer / explainLandform) dispatched to renderer globe APIs → results fed back → streamed
  answer. Globe tools are registered renderer-side; new capabilities = new tool definitions.
- Map providers (OSM, Mapbox, ArcGIS) implement a unified `LayerProvider`
  interface; terrain providers are pluggable for future offline terrain packs.

## Roadmap

Core platform:

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Scaffold: electron-vite + TS + Vue + Cesium build | Done (`1a61c43`) |
| 1 | Globe core: viewer, camera, fly-to, basemap layers, layer-manager skeleton | Done |
| 2 | Multi-provider layers, API-key settings (encrypted), terrain providers, tile cache | Done |
| 3 | Teaching tools: draw point/line/polygon, measure distance/area, annotations, persistence | Done |
| 4 | EOQ agent: provider-agnostic AI settings, streaming chat, tool-calling bridge | Done |
| 5 | Packaging, auto-update stub, offline groundwork, performance | Pending |

Teaching modules (人教版选择性必修一 mapping; thematic layers live in `src/renderer/src/thematic/`, registered in `useThematicLayers.ts`):

| Module | Scope | Status |
| --- | --- | --- |
| M1 | Earth's motion: solar terminator timeline (date/hour, solstice/equinox presets), day-length & noon-altitude charts, Coriolis demo layer, timezone compare tool, `set_sim_time`/`query_solar` AI tools | Done |
| M2 | Atmosphere: pressure/wind belt layer (Jan/Jul shift), global Köppen zones, thematic-entity picking + AI explain, frontal-cyclone anchored overlay, `set_layer` tool | Done |
| M3 | Landforms: plate boundaries + USGS earthquakes/volcanoes (dataset fetch + cache in main process), `explain_landform` tool | Planned |
| M4 | Ocean: ENSO phase layer (El Niño / La Niña SST anomaly + Walker circulation overlay) | Planned |
| M5 | Integrality/zonation: `find_peaks`, mountain vertical zonation profile, guided transect flights (`fly_transect`) | Planned |

## Commands

```bash
npm run dev        # electron-vite dev server + app
npm run build      # production build
npm run typecheck  # tsc (node) + vue-tsc (web)
```

## Docs

- https://ant.design/llms.txt

## Conventions

- **UI**: Use Ant Design Vue components and the tokens in [DESIGN.md](./DESIGN.md). All visual
  decisions — colors, typography, spacing, radii, elevation, motion, component states — are
  governed by DESIGN.md; do not invent local design rules. Custom components only where Ant
  Design has no equivalent (e.g. globe-anchored overlays), built from DESIGN.md tokens.
- **No code comments** in any file type. Encode reasoning in names, structure, and tests.
- **Commit messages and PR titles/descriptions in English.** Conversation with the user in
  Chinese.
- Renderer root is `src/renderer`. Cesium's static assets are served and copied by the inline
  `cesiumStaticPlugin` in `electron.vite.config.ts`; do not swap in a glob-based copy plugin —
  on Windows it nests the full source path under `dest`, and `rename.stripBase` miscounts
  backslash-separated segments.
- Verify UI changes by running `npm run dev` and exercising the feature; report explicitly if a
  change could not be visually verified.
