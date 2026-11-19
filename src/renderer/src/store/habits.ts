import { create } from 'zustand'
import { initialHabits, type Habit } from '../data/habits'
import { supabase } from '../lib/supabase'
import { appToday, dayKey } from '../lib/clock'

/** Habits skipped today are remembered on this device for the day only. */
const SKIP_KEY = 'nexday.habitSkips'
const loadSkips = (): string[] => {
  try {
    const j = JSON.parse(localStorage.getItem(SKIP_KEY) ?? 'null') as { day: string; ids: string[] } | null
    return j && j.day === dayKey(appToday()) && Array.isArray(j.ids) ? j.ids : []
  } catch {
    return []
  }
}
const saveSkips = (ids: string[]): void => {
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify({ day: dayKey(appToday()), ids }))
  } catch {
    /* private mode: skips last until reload */
  }
}

type HabitsState = {
  habits: Habit[]
  /** Habit id → day keys (YYYY-MM-DD) checked in over the last 12 weeks, today excluded. Today comes from `doneToday`. */
  history: Record<string, string[]>
  /** Ids of habits skipped today */
  skipped: string[]
  skipToday: (id: string) => void
  setPaused: (id: string, paused: boolean) => void
  toggleToday: (id: string) => void
  add: (name: string, opts?: { time?: string; lengthMin?: number; days?: number[] }) => void
}

export const useHabits = create<HabitsState>((set) => ({
  habits: supabase ? [] : initialHabits,
  history: {},
  skipped: loadSkips(),
  skipToday: (id) =>
    set((s) => {
      const skipped = s.skipped.includes(id) ? s.skipped : [...s.skipped, id]
      saveSkips(skipped)
      return { skipped }
    }),
  setPaused: (id, paused) => set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, paused } : h)) })),
  add: (name, opts) =>
    set((s) => {
      const time = opts?.time || '09:00'
      const lengthMin = opts?.lengthMin ?? 5
      const [h, m] = time.split(':').map(Number)
      const end = h * 60 + m + lengthMin
      const slotEnd = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const days = opts?.days ?? [0, 1, 2, 3, 4, 5, 6]
      const every =
        days.length === 7 ? 'Every day' : days.length === 5 && days.every((d) => d < 5) ? 'Weekdays' : days.map((d) => names[d]).join(', ')
      return {
        habits: [
          ...s.habits,
          {
            id: crypto.randomUUID(),
            name,
            sub: `${every} · ${time} · ${lengthMin} min`,
            time,
            length: `${lengthMin} min`,
            slotEnd,
            group: h < 12 ? ('morning' as const) : ('evening' as const),
            rate: 0,
            streak: 0,
            checkIns: 0,
            doneToday: false,
            upNextIn: 'soon'
          }
        ]
      }
    }),
  toggleToday: (id) =>
    set((s) => {
      // Marking a habit done takes back an earlier skip
      const skipped = s.skipped.filter((x) => x !== id)
      if (skipped.length !== s.skipped.length) saveSkips(skipped)
      return {
        skipped,
        habits: s.habits.map((h) => (h.id === id ? { ...h, doneToday: !h.doneToday } : h))
      }
    })
}))
