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
  toggleToday: (id: string) => void
  add: (name: string) => void
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
  add: (name) =>
    set((s) => ({
      habits: [
        ...s.habits,
        {
          id: crypto.randomUUID(),
          name,
          sub: 'Every 2 hours · 09:00 – 17:00',
          time: '09:00',
          length: '5 min',
          slotEnd: '09:05',
          group: 'morning',
          rate: 0,
          streak: 0,
          checkIns: 0,
          doneToday: false,
          upNextIn: 'in 1 hour'
        }
      ]
    })),
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
