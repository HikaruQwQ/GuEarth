# GuEarth performance baseline

- captured: 2026-10-06T12:01:30.717Z
- platform: win32 x64, node v24.13.0
- userData: C:\Users\guyuh\AppData\Roaming\GuEarth

## 1. userData inventory

| file | bytes |
| --- | --- |
| settings.json | 873 |
| annotations.json | 152618 |
| scenes.json | missing |
| ai-settings.json | 1125 |
| ai-chat-history.json | 322508 |
| ai-memories.json | 291 |
| earthquakes.json | 69321 |

- recursive walk of userData (stat every file): median 249.07 ms (n=1, min 249.07, max 249.07)
- files walked: 59086
- total: 800.60 MB across 59086 files

| top-level entry | files | MB |
| --- | --- | --- |
| tile-cache | 56036 | 377.45 |
| Cache | 1547 | 338.50 |
| Code Cache | 1347 | 70.79 |
| GPUCache | 79 | 6.82 |
| GrShaderCache | 15 | 4.75 |
| ShaderCache | 5 | 0.53 |
| DawnWebGPUCache | 5 | 0.53 |
| DawnGraphiteCache | 5 | 0.53 |
| ai-chat-history.json | 1 | 0.31 |
| annotations.json | 1 | 0.15 |
| earthquakes.json | 1 | 0.07 |
| Network | 7 | 0.06 |
| Shared Dictionary | 4 | 0.04 |
| DIPS | 1 | 0.04 |
| declarative_performance_observer.db | 1 | 0.03 |
| sentry | 2 | 0.00 |
| Local Storage | 6 | 0.00 |
| Session Storage | 6 | 0.00 |
| ai-settings.json | 1 | 0.00 |
| settings.json | 1 | 0.00 |
| Local State | 1 | 0.00 |
| credentials | 6 | 0.00 |
| ai-memories.json | 1 | 0.00 |
| DevToolsActivePort | 1 | 0.00 |
| Preferences | 1 | 0.00 |
| Crashpad | 1 | 0.00 |
| declarative_performance_observer.db-journal | 1 | 0.00 |
| GPUPersistentCache | 3 | 0.00 |

## 2. tile cache

- tile meta files (.json under a path matching /tile/): 28018
- tile payload files (.bin anywhere): 28024
- tile payload bytes total: 376.01 MB, average per tile: 13.74 KB
- replicate readTile x200 (2x existsSync + read json + parse + read bin): median 194.61 ms (n=3, min 107.44, max 213.37)
- collectFiles + statSync on the real tile cache (cacheStats path): median 4053.57 ms (n=1, min 4053.57, max 4053.57)
- replicate writeTile x200 (recursive mkdir + write bin + write meta): median 257.37 ms (n=3, min 253.54, max 353.44)

## 3. write cost of the JSON stores (measured on the real files)

- ai-chat-history.json: compact 0.24 MB, pretty 0.31 MB
- ai-chat-history.json :: stringify compact: median 1.32 ms (n=3, min 1.17, max 2.18)
- ai-chat-history.json :: stringify pretty (current code path): median 2.61 ms (n=3, min 2.5, max 2.78)
- annotations.json: compact 0.15 MB, pretty 0.24 MB
- annotations.json :: stringify compact: median 1.06 ms (n=3, min 0.92, max 1.86)
- annotations.json :: stringify pretty (current code path): median 1.92 ms (n=3, min 1.06, max 2.26)
- earthquakes.json: compact 0.07 MB, pretty 0.09 MB
- earthquakes.json :: stringify compact: median 0.68 ms (n=3, min 0.64, max 0.77)
- earthquakes.json :: stringify pretty (current code path): median 0.44 ms (n=3, min 0.42, max 0.57)

- earthquakes.json top-level: fetchedAt, events
- earthquakes.json events: 522 items
## 4. V8 parse + compile cost of the shipped bundles

- vm.SourceTextModule available: yes
- out\renderer\assets\index-EH5tGzVU.js (14.45 MB, module) parse+compile: median 429.36 ms (n=3, min 422.03, max 438.64)
- out\renderer\assets\SearchSources-Bx9a3sjL.js (1.15 MB, module) parse+compile: median 37.13 ms (n=3, min 35.6, max 37.56)
- node_modules\cesium\Build\Cesium\Cesium.js (5.74 MB, script) parse+compile: median 0.07 ms (n=3, min 0.01, max 0.07)

## 5. cesium package layout

- version: 1.145.0
- main: index.cjs
- module: ./Source/Cesium.js
- exports: {"./package.json":"./package.json","./Source/*":"./Source/*","./Source/*.js":null,"./Build/*":"./Build/*","./Build/*.js":null,".":{"types":"./Source/Cesium.d.ts","require":"./index.cjs","import":"./Source/Cesium.js"}}
- index.js: missing
- index.cjs: 0.00 MB
- Source/Cesium.js: 0.07 MB
- Build/Cesium/index.js: 4.53 MB
- Build/Cesium/Cesium.js: 5.74 MB

## 6. startup-critical remote calls

| endpoint | sample | ms | bytes | status |
| --- | --- | --- | --- | --- |
| arcgis terrain metadata | 1 | 627.94 | 6722 | 200 |
| arcgis terrain metadata | 2 | 666.66 | 6722 | 200 |
| arcgis terrain metadata | 3 | 294.98 | 6722 | 200 |
| terrain height tile z3 (LERC) | 1 | 395.77 | 90272 | 200 |
| terrain height tile z3 (LERC) | 2 | 349.85 | 90272 | 200 |
| terrain height tile z3 (LERC) | 3 | 342.58 | 90272 | 200 |
| osm imagery tile z3 | 1 | 10544.53 | -1 | error: TypeError |
| osm imagery tile z3 | 2 | 10531.69 | -1 | error: TypeError |
| osm imagery tile z3 | 3 | 10569.71 | -1 | error: TypeError |
| esri imagery tile z3 | 1 | 10548.24 | -1 | error: TypeError |
| esri imagery tile z3 | 2 | 10532.14 | -1 | error: TypeError |
| esri imagery tile z3 | 3 | 10532.93 | -1 | error: TypeError |
