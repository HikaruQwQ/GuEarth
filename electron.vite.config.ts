import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const cesiumBuild = resolve('node_modules/cesium/Build/Cesium').replace(/\\/g, '/')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      vue(),
      viteStaticCopy({
        targets: [
          { src: `${cesiumBuild}/Workers`, dest: 'cesium' },
          { src: `${cesiumBuild}/ThirdParty`, dest: 'cesium' },
          { src: `${cesiumBuild}/Assets`, dest: 'cesium' },
          { src: `${cesiumBuild}/Widgets`, dest: 'cesium' }
        ]
      })
    ],
    define: {
      CESIUM_BASE_URL: JSON.stringify('./cesium')
    }
  }
})
