export type HabitGroup = 'morning' | 'evening'

export type Habit = {
  id: string
  name: string
  /** "Every day · 07:00 · 30 min" */
  sub: string
  time: string
  length: string
  /** End of the slot, shown in "Up next" and the drawer header */
  slotEnd: string
  group: HabitGroup
  rate: number
  streak: number
  checkIns: number
  /** Checked in today in the initial data */
  doneToday: boolean
  upNextIn: string
  upNextNote?: string
}

export const initialHabits: Habit[] = [
  {
    id: 'run',
    name: 'Morning run',
    sub: 'Every day · 07:00 · 30 min',
    time: '07:00',
    length: '30 min',
    slotEnd: '07:30',
    group: 'morning',
    rate: 90,
    streak: 12,
    checkIns: 41,
    doneToday: true,
    upNextIn: 'in 20 hours'
  },
  {
    id: 'stretch',
    name: 'Stretch 10 min',
    sub: 'Every day · 07:45 · 10 min',
    time: '07:45',
    length: '10 min',
    slotEnd: '07:55',
    group: 'morning',
    rate: 52,
    streak: 3,
    checkIns: 27,
    doneToday: true,
    upNextIn: 'in 21 hours'
  },
  {
    id: 'read',
    name: 'Read 20 pages',
    sub: 'Every day · 20:30 · 30 min',
    time: '20:30',
    length: '30 min',
    slotEnd: '21:00',
    group: 'evening',
    rate: 74,
    streak: 5,
    checkIns: 33,
    doneToday: false,
    upNextIn: 'in 10 hours',
    upNextNote: 'after Book club'
  },
  {
    id: 'phone',
    name: 'Phone-free evening',
    sub: 'Every day · 21:00 · 1 h',
    time: '21:00',
    length: '1 h',
    slotEnd: '22:00',
    group: 'evening',
    rate: 68,
    streak: 2,
    checkIns: 30,
    doneToday: false,
    upNextIn: 'in 10 hours'
  },
  {
    id: 'journal',
    name: 'Journal',
    sub: 'Every night · 22:00 · 10 min',
    time: '22:00',
    length: '10 min',
    slotEnd: '22:10',
    group: 'evening',
    rate: 84,
    streak: 8,
    checkIns: 36,
    doneToday: false,
    upNextIn: 'in 11 hours'
  }
]

/** 12 weeks (Mon → Sun per column), levels 0–3. */
export const heatmap: number[][] = [
  [1, 2, 1, 0, 2, 1, 0],
  [2, 1, 2, 1, 1, 0, 1],
  [1, 2, 2, 2, 1, 1, 0],
  [2, 2, 1, 2, 3, 1, 1],
  [2, 2, 3, 2, 2, 1, 2],
  [3, 2, 2, 3, 2, 2, 1],
  [2, 3, 3, 2, 3, 2, 2],
  [3, 3, 2, 3, 3, 2, 2],
  [3, 3, 3, 2, 3, 3, 2],
  [3, 3, 3, 3, 3, 2, 3],
  [3, 3, 2, 3, 3, 3, 2],
  [3, 3, 3, 3, 3, 2, 0]
]

export const habitSuggestions = [
  { name: 'Morning run', hint: '07:00 · 30 min' },
  { name: 'Read 20 pages', hint: '20:30 · 30 min' },
  { name: 'Journal', hint: '22:00 · 10 min' }
]
