import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  store: {
    load: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:load'),
    save: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('store:save', key, value),
    clear: (): Promise<void> => ipcRenderer.invoke('store:clear')
  },
  secure: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('secure:get', key),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('secure:set', key, value),
    remove: (key: string): Promise<void> => ipcRenderer.invoke('secure:remove', key)
  },
  files: {
    save: (name: string, text: string): Promise<{ path: string } | null> =>
      ipcRenderer.invoke('file:save', name, text),
    open: (): Promise<{ name: string; text: string } | { error: string } | null> =>
      ipcRenderer.invoke('file:open')
  },
  login: {
    get: (): Promise<{ supported: boolean; on: boolean }> => ipcRenderer.invoke('login:get'),
    set: (on: boolean): Promise<boolean> => ipcRenderer.invoke('login:set', on)
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  onAuthCallback: (cb: (url: string) => void): (() => void) => {
    const handler = (_e: unknown, url: string): void => cb(url)
    ipcRenderer.on('auth:callback', handler)
    return () => ipcRenderer.removeListener('auth:callback', handler)
  },
  reminders: {
    status: (): Promise<unknown> => ipcRenderer.invoke('rem:status'),
    request: (): Promise<unknown> => ipcRenderer.invoke('rem:request'),
    list: (): Promise<unknown> => ipcRenderer.invoke('rem:list')
  },
  calendar: {
    status: (): Promise<unknown> => ipcRenderer.invoke('cal:status'),
    request: (): Promise<unknown> => ipcRenderer.invoke('cal:request'),
    calendars: (): Promise<unknown> => ipcRenderer.invoke('cal:calendars'),
    events: (startMs: number, endMs: number): Promise<unknown> =>
      ipcRenderer.invoke('cal:events', startMs, endMs),
    create: (payload: unknown): Promise<unknown> => ipcRenderer.invoke('cal:create', payload),
    update: (id: string, startMs: number, endMs: number): Promise<unknown> =>
      ipcRenderer.invoke('cal:update', id, startMs, endMs),
    remove: (id: string): Promise<unknown> => ipcRenderer.invoke('cal:delete', id)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
