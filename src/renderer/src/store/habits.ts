import { create } from 'zustand'
import { initialHabits, type Habit } from '../data/habits'
import { supabase } from '../lib/supabase'

type HabitsState = {
  habits: Habit[]
  toggleToday: (id: string) => void
  add: (name: string) => void
}

export const useHabits = create<HabitsState>((set) => ({
  habits: supabase ? [] : initialHabits,
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
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, doneToday: !h.doneToday } : h))
    }))
}))
