import { addDays, appToday, dayKey, sameDay, weekdayShort } from '../lib/clock'

export type EventKind = 'work' | 'blue' | 'acc' | 'personal' | 'health' | 'moved'

export type CalEvent = {
  id: string
  /** YYYY-MM-DD (local) */
  date: string
  /** 0 = Mon … 6 = Sun */
  day: number
  /** Decimal hours, 9.5 = 09:30 */
  start: number
  end: number
  title: string
  /** Second line in the week view */
  sub?: string
  /** Second line in the day view when it differs from the week view */
  daySub?: string
  /** Title used by the month cells */
  monthTitle?: string
  /** All-day events sit above the hour grid instead of inside it. */
  allDay?: boolean
  /** For a recurring occurrence: the Nexday event it came from. */
  sourceId?: string
}

type Def = Omit<CalEvent, 'id' | 'date'> & { kind: EventKind }
export type KindedEvent = CalEvent & { kind: EventKind }

const defs: Def[] = [
  { day: 0, start: 9, end: 9.5, title: 'Team standup', kind: 'work' },
  {
    day: 0,
    start: 14,
    end: 16,
    title: 'Sprint planning',
    sub: '14:00–16:00 · Google Meet',
    kind: 'blue'
  },

  {
    day: 1,
    start: 9,
    end: 11,
    title: 'Deep work · Onboarding',
    sub: '09:00–11:00 · Focus block',
    monthTitle: 'Deep work',
    kind: 'acc'
  },
  {
    day: 1,
    start: 11.5,
    end: 12.5,
    title: 'Product sync',
    sub: '11:30–12:30 · Google Meet',
    kind: 'work'
  },
  {
    day: 1,
    start: 15,
    end: 16.5,
    title: 'Design critique',
    sub: '15:00–16:30 · Planner MVP',
    kind: 'blue'
  },
  {
    day: 1,
    start: 17,
    end: 18,
    title: 'Pitch draft',
    sub: '17:00–18:00 · moved',
    daySub: '17:00–18:00 · moved from 10:30',
    kind: 'moved'
  },
  {
    day: 1,
    start: 19.5,
    end: 20,
    title: 'Book club · 19:30',
    monthTitle: 'Book club',
    kind: 'personal'
  },

  { day: 2, start: 9, end: 9.5, title: '1:1 with Ece', kind: 'work' },
  { day: 2, start: 13, end: 15, title: 'Deep work', sub: '13:00–15:00 · Focus', kind: 'acc' },

  { day: 3, start: 9, end: 9.5, title: 'Team standup', kind: 'work' },
  {
    day: 3,
    start: 11,
    end: 13,
    title: 'User interviews',
    sub: '11:00–13:00 · Planner MVP',
    kind: 'blue'
  },
  {
    day: 3,
    start: 17,
    end: 18.5,
    title: 'Pack moving boxes',
    sub: '17:00–19:00',
    kind: 'personal'
  },

  { day: 4, start: 9, end: 9.5, title: 'Team standup', kind: 'work' },
  { day: 4, start: 10, end: 12, title: 'Demo prep', sub: '10:00–12:00 · Focus', kind: 'acc' },
  {
    day: 4,
    start: 15,
    end: 16,
    title: 'Product demo',
    sub: '15:00–16:00 · Investors',
    kind: 'blue'
  },
  { day: 4, start: 19, end: 20, title: 'Team dinner', sub: '19:00 · Neolokal', kind: 'personal' },

  { day: 5, start: 8, end: 9, title: 'Morning run', sub: '08:00–09:00', kind: 'health' }
]

/**
 * The design week, moved onto the real dates of any week. Once Mac Calendar is connected its live
 * events replace these; until then the current week keeps the sample content.
 */
export function sampleWeekEvents(start: Date): KindedEvent[] {
  const key = dayKey(start)
  return defs.map((d, i) => ({
    ...d,
    id: `${key}-e${i}`,
    date: dayKey(addDays(start, d.day))
  }))
}

/** Monday-first header cells for a week. */
export function weekDays(
  start: Date
): Array<{ n: number; label: string; date: string; today: boolean }> {
  const today = appToday()
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i)
    return { n: d.getDate(), label: weekdayShort(d), date: dayKey(d), today: sameDay(d, today) }
  })
}

/** Hour grid starts at 08:00 (the first row is 08–09). */
export const GRID_START = 8

export const fmtTime = (h: number): string => {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/* ---------- Month ---------- */

export type MonthEvent = { kind: EventKind; title: string; time: string }

const m = (kind: EventKind, title: string, time: string): MonthEvent => ({ kind, title, time })
const standup = m('work', 'Team standup', '09:00')

/** Sample events for the rest of the design month (Nov 2026). Kept so the month view is not bare. */
const monthOnly: Record<number, MonthEvent[]> = {
  2: [standup],
  3: [standup, m('blue', 'Design review', '14:00')],
  4: [standup],
  5: [standup, m('personal', 'Dentist', '17:30')],
  6: [standup, m('personal', 'Team lunch', '13:00')],
  7: [m('health', 'Morning run', '08:00')],
  9: [standup, m('blue', 'Sprint planning', '14:00')],
  10: [standup],
  11: [standup],
  12: [standup],
  13: [standup],
  14: [m('health', 'Morning run', '08:00')],
  23: [standup],
  24: [standup, m('blue', 'Sprint review', '15:00')],
  25: [m('blue', 'User testing', 'All day'), standup],
  26: [standup, m('personal', "Mert's birthday", '19:00')],
  27: [standup],
  28: [m('health', 'Long run', '08:00')],
  30: [standup]
}

export const dotColor: Record<EventKind, string> = {
  work: 'var(--work)',
  blue: 'var(--blue)',
  acc: 'var(--acc)',
  personal: 'var(--personal)',
  health: 'var(--health)',
  moved: 'var(--acc)'
}

export const eventClass: Record<EventKind, string> = {
  work: 'ev-work',
  blue: 'ev-blue',
  acc: 'ev-acc',
  personal: 'ev-personal',
  health: 'ev-health',
  moved: 'ev-moved'
}

export type MonthCell = {
  key: string
  date: string
  n: number
  other: boolean
  weekend: boolean
  today: boolean
  past: boolean
  events: MonthEvent[]
}

/** Six Monday-first weeks covering the month of `cursor`, with events matched by date. */
export function monthWeeks(cursor: Date, events: KindedEvent[]): MonthCell[][] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const start = addDays(first, -lead)
  const today = appToday()

  const byDate = new Map<string, MonthEvent[]>()
  for (const e of events) {
    const list = byDate.get(e.date) ?? []
    list.push(m(e.kind, e.monthTitle ?? e.title, e.allDay ? 'All day' : fmtTime(e.start)))
    byDate.set(e.date, list)
  }
  for (const list of byDate.values()) list.sort((a, b) => a.time.localeCompare(b.time))

  // The design's November filler, only while November 2026 is the month on screen.
  const designMonth = cursor.getFullYear() === 2026 && cursor.getMonth() === 10

  const weeks: MonthCell[][] = []
  for (let w = 0; w < 6; w++) {
    const row: MonthCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d)
      const key = dayKey(date)
      const inMonth = date.getMonth() === cursor.getMonth()
      let list = byDate.get(key) ?? []
      if (!list.length && inMonth && designMonth) list = monthOnly[date.getDate()] ?? []
      row.push({
        key,
        date: key,
        n: date.getDate(),
        other: !inMonth,
        weekend: d >= 5,
        today: sameDay(date, today),
        past: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        events: list
      })
    }
    weeks.push(row)
  }
  return weeks
}
