import type { StoreApi } from 'zustand'
import { useHabits } from '../store/habits'
import { useInbox } from '../store/inbox'
import { useNotifs } from '../store/notifs'
import { useProjects } from '../store/projects'
import { useTasks } from '../store/tasks'
import { useUI } from '../store/ui'
import { supabase } from './supabase'

/**
 * Persistence. In the Electron app slices go to the main process, which writes one JSON file in
 * the user data folder. In a plain browser (preview, tests) the same slices go to localStorage.
 */
const LS = 'nexday.data'

type Backend = {
  load: () => Promise<Record<string, unknown>>
  save: (key: string, value: unknown) => void
}

const backend: Backend = window.api?.store
  ? { load: () => window.api!.store.load(), save: (k, v) => void window.api!.store.save(k, v) }
  : {
      load: async () => {
        try {
          return JSON.parse(localStorage.getItem(LS) ?? '{}') as Record<string, unknown>
        } catch {
          return {}
        }
      },
      save: (k, v) => {
        try {
          const all = JSON.parse(localStorage.getItem(LS) ?? '{}') as Record<string, unknown>
          all[k] = v
          localStorage.setItem(LS, JSON.stringify(all))
        } catch {
          /* storage unavailable */
        }
      }
    }

type Slice<S> = {
  key: string
  store: StoreApi<S>
  pick: (s: S) => unknown
  restore: (data: never) => Partial<S>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slices: Array<Slice<any>> = [
  {
    key: 'tasks',
    store: useTasks,
    pick: (s) => s.groups,
    restore: (d: unknown) => ({ groups: d })
  },
  { key: 'inbox', store: useInbox, pick: (s) => s.items, restore: (d: unknown) => ({ items: d }) },
  {
    key: 'habits',
    store: useHabits,
    pick: (s) => s.habits,
    restore: (d: unknown) => ({ habits: d })
  },
  {
    key: 'notifs',
    store: useNotifs,
    pick: (s) => s.items,
    restore: (d: unknown) => ({ items: d })
  },
  {
    key: 'projects',
    store: useProjects,
    pick: (s) => s.custom,
    restore: (d: unknown) => ({ custom: d })
  },
  {
    key: 'ui',
    store: useUI,
    pick: (s) => ({
      autoSchedule: s.autoSchedule,
      pauseNotifs: s.pauseNotifs,
      planning: s.planning,
      prefs: s.prefs,
      notifPrefs: s.notifPrefs,
      calPrefs: s.calPrefs
    }),
    restore: (d: unknown) => d as Record<string, boolean>
  }
]

const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Load saved slices into the stores, then keep saving them whenever they change. */
export async function initPersistence(): Promise<void> {
  // With an account, the cloud holds the data; a local copy would only show the previous person's things.
  if (supabase) return
  let saved: Record<string, unknown> = {}
  try {
    saved = await backend.load()
  } catch {
    /* start from the built-in data */
  }
  for (const s of slices) {
    const data = saved[s.key]
    if (data !== undefined && data !== null) s.store.setState(s.restore(data as never))
  }
  for (const s of slices) {
    let last = JSON.stringify(s.pick(s.store.getState()))
    s.store.subscribe((state) => {
      const next = JSON.stringify(s.pick(state))
      if (next === last) return
      last = next
      clearTimeout(timers.get(s.key))
      timers.set(
        s.key,
        setTimeout(() => backend.save(s.key, JSON.parse(next)), 150)
      )
    })
  }
}
