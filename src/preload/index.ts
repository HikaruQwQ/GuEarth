import { contextBridge } from 'electron'

const api = {
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }
}

export type GuEarthApi = typeof api

contextBridge.exposeInMainWorld('guEarth', api)
