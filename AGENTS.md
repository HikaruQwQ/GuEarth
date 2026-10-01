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
| Renderer | Vue 3 + Pinia + **Ant Design Vue** | UI framework is Ant Design Vue — see [DESIGN.md](./DESIGN.md) || 3D / Map | CesiumJS | Static assets (Workers/Assets/Widgets) copied to `cesium/` via vite-plugin-static-copy; `CESIUM_BASE_URL=./cesium` |
| AI | OpenAI-compatible streaming client in the main process | Provider-agnostic (DeepSeek/Qwen/OpenAI…); API keys live **only** in the main process via `safeStorage`, never in the renderer |
| Storage | better-sqlite3 + electron-store | Annotations, bookmarks, lessons; settings |
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
- Map providers (Tianditu WMTS, OSM, Mapbox, ArcGIS) implement a unified `LayerProvider`
  interface; terrain providers are pluggable for future offline terrain packs.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Scaffold: electron-vite + TS + Vue + Cesium build | Done (`1a61c43`) |
| 1 | Globe core: viewer, camera, fly-to, basemap layers, layer-manager skeleton | Pending |
| 2 | Multi-provider layers, API-key settings (encrypted), terrain providers, tile cache | Pending |
| 3 | Teaching tools: draw point/line/polygon, measure distance/area, annotations, persistence | Pending |
| 4 | EOQ agent: provider-agnostic AI settings, streaming chat, tool-calling bridge | Pending |
| 5 | Packaging, auto-update stub, offline groundwork, performance | Pending |

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
- Renderer root is `src/renderer` — static-copy/glob paths must be absolute with **forward
  slashes** on Windows.
- Verify UI changes by running `npm run dev` and exercising the feature; report explicitly if a
  change could not be visually verified.
