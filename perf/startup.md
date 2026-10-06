# GuEarth startup measurement (production)

## Method

- Build: `npm run build`, then run the production app via `npm run start` (`electron-vite preview`).
- Logging: `ELECTRON_ENABLE_LOGGING=1`, so renderer `console.log` lands on stdout as `INFO:CONSOLE`.
- Probe: `src/renderer/src/composables/usePerfProbe.ts`, logs `performance.now()` (relative to navigation start) at each milestone, then samples frame rate over 5 s at t15 and t60.
- Environment: single run, Windows desktop, no proxy, `networkProxy` empty in settings.
- Configured providers at measurement time: basemap `esri-imagery`, terrain `arcgis-terrain`, `terrainExaggeration: 1`, `tileCacheEnabled: true`.

## Production timeline (one run)

| milestone | ms since navigation start |
| --- | --- |
| probe module evaluated (bundle parsed and executed) | 298.9 |
| Vue app mounted | 327.6 |
| stage line: 正在准备地形数据… | 533.4 |
| Viewer created | 533.4 |
| imagery layer attached | 533.4 |
| tile requests started | 1289.5 |
| stage line: 正在加载地图瓦片… | 1294.3 |
| globe visible | 1294.4 |
| loading card dismissed | 20549.3 |

## Frame rate, memory, entities

| sample | fps (5 s window) | renderer JS heap | entities in `viewer.entities` | imagery layers | `globe.tilesLoaded` |
| --- | --- | --- | --- | --- | --- |
| t15 | 54.6 | 77.6 MB used / 141.1 MB total | 442 | 1 | false |
| t60 | 0.0 | 77.6 MB used / 141.1 MB total | 442 | 1 | false |

No thematic data sources were active in this run, so all 442 entities come from the persisted annotation store
(`annotations.json` holds 442 shapes: 441 points and 1 polyline). Chat history held 2 conversations / 14 messages.

## Interpretation

- The renderer bundle is parsed and executed by ~299 ms, and the globe is visible at ~1.29 s.
- The loading card stays until ~20.5 s, which is the 20 s loading timeout firing, not slow app code: no tile
  request ever settled. The configured basemap `esri-imagery` is unreachable from this network
  (see baseline.md section 6: connect timeout, 10 s), so the imagery tiles time out.
- Frame rate at t15 is 54.6 fps while the app is completely idle, so the scene renders continuously.
- The 0.0 fps sample at t60 is most likely window-occlusion throttling rather than an app stall; it needs a
  visible-window re-run to be trusted.

## Dev-mode comparison (not representative of production)

| milestone | dev (`npm run dev`) |
| --- | --- |
| probe module evaluated | 8474.9 ms |
| Vue app mounted | 8553.2 ms |
| Viewer created | 9096.8 ms |
| globe visible | 10252.2 ms |
| loading card dismissed | 30048.4 ms |

Dev mode serves the renderer as thousands of separate module requests, so module evaluation is ~28x slower
than the production bundle. Dev numbers must not be used as the startup baseline.

## Machine

| item | value |
| --- | --- |
| CPU | 13th Gen Intel Core i5-13500H, 12 cores / 16 threads, 2.6 GHz |
| RAM | 31.7 GB |
| GPU | Intel Iris Xe Graphics (integrated), driver 32.0.101.7084 |
| Display | 2520 x 1680 @ 60 Hz |
| Node / Electron | v24.13.0 / 44.5.1 |

The display is a high-DPI panel and the Viewer sets `useBrowserRecommendedResolution: false`, so frames are
rasterized at the full 2520 x 1680 physical resolution (about 4.2 MP per frame) on an integrated GPU.

## Caveats

- Single sample per milestone; repeat runs are needed for a stable baseline, and a visible, unoccluded window
  is required for trustworthy frame-rate numbers.
- The probe file (`usePerfProbe.ts` plus two lines in `App.vue`) is measurement instrumentation and must not
  be merged into `main`.
