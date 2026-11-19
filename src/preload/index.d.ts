import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api?: {
      store: {
        load: () => Promise<Record<string, unknown>>
        save: (key: string, value: unknown) => Promise<void>
        clear: () => Promise<void>
      }
      secure: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<void>
        remove: (key: string) => Promise<void>
      }
      openExternal: (url: string) => Promise<void>
      onAuthCallback: (cb: (url: string) => void) => () => void
      calendar: {
        status: () => Promise<unknown>
        request: () => Promise<unknown>
        calendars: () => Promise<unknown>
        events: (startMs: number, endMs: number) => Promise<unknown>
        create: (payload: {
          title: string
          startMs: number
          endMs: number
          allDay: boolean
          location?: string | null
          rrule?: string | null
        }) => Promise<unknown>
        remove: (id: string) => Promise<unknown>
      }
    }
  }
}
