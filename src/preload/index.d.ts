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
      files: {
        save: (name: string, text: string) => Promise<{ path: string } | null>
        open: () => Promise<{ name: string; text: string } | { error: string } | null>
      }
      login: {
        get: () => Promise<{ supported: boolean; on: boolean }>
        set: (on: boolean) => Promise<boolean>
      }
      openExternal: (url: string) => Promise<void>
      onAuthCallback: (cb: (url: string) => void) => () => void
      reminders: {
        status: () => Promise<unknown>
        request: () => Promise<unknown>
        list: () => Promise<unknown>
      }
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
        update: (id: string, startMs: number, endMs: number) => Promise<unknown>
        remove: (id: string) => Promise<unknown>
      }
    }
  }
}
