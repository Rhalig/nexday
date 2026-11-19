import { create } from 'zustand'
import { useUI } from './ui'
import { sampleWeekEvents, type KindedEvent } from '../data/calendar'
import type { EventKind } from '../data/calendar'
import {
  addDays,
  appToday,
  dayKey,
  parseDayKey,
  startOfDay,
  startOfMonth,
  startOfWeek
} from '../lib/clock'

export type AccessStatus =
  'unknown' | 'unavailable' | 'notDetermined' | 'denied' | 'restricted' | 'writeOnly' | 'authorized'
export type MacCalendar = { id: string; title: string; color: string; source: string }

/** An event created inside Nexday, stored in the events table. */
export type PlanEvent = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  kind: EventKind
  location?: string | null
  allDay?: boolean
  /** Simple RFC 5545 text, e.g. FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR */
  rrule?: string | null
  /** EventKit identifier once the event has been written to Mac Calendar. */
  externalId?: string | null
}

type RawEvent = {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  calendar: string
  color: string
  location?: string
  declined?: boolean
}

type Range = { from: string; to: string }

type CalendarState = {
  status: AccessStatus
  /** Mac Calendar events for the loaded range, or the design week while it is not connected. */
  base: KindedEvent[]
  /** Events created in Nexday (the events table). */
  own: PlanEvent[]
  /** base + own inside `range`: what the Calendar and Today pages draw. */
  events: KindedEvent[]
  live: boolean
  calendars: MacCalendar[]
  lastSync: number | null
  busy: boolean
  /** Monday of the week the week view shows. */
  weekStart: Date
  /** YYYY-MM-DD the day view shows. */
  day: string
  /** First day of the month the month view shows. */
  month: Date
  range: Range | null
  refresh: () => Promise<void>
  connect: () => Promise<void>
  loadWeek: (start: Date) => Promise<void>
  loadMonth: (cursor: Date) => Promise<void>
  /** Load `days` days starting at `from` (the planner looks several days ahead). */
  loadSpan: (from: Date, days: number) => Promise<void>
  setDay: (date: string) => Promise<void>
  add: (input: {
    title: string
    date: string
    start: string
    end: string
    kind?: EventKind
    location?: string
    allDay?: boolean
    rrule?: string | null
  }) => string
  /** Moves an event made in Nexday (and its Mac Calendar copy) to a new day and start time. */
  move: (id: string, date: string, startMin: number) => void
  remove: (id: string) => void
  setOwn: (events: PlanEvent[]) => void
  reset: () => void
}

const api = window.api?.calendar

function kindFor(calendar: string): EventKind {
  const c = calendar.toLowerCase()
  if (/work|office|team/.test(c)) return 'work'
  if (/personal|home|family/.test(c)) return 'personal'
  if (/health|fitness|run|gym/.test(c)) return 'health'
  return 'blue'
}

const hh = (n: number): string =>
  `${String(Math.floor(n)).padStart(2, '0')}:${String(Math.round((n % 1) * 60)).padStart(2, '0')}`

const weekdayIndex = (d: Date): number => (d.getDay() + 6) % 7

function convert(raw: RawEvent[]): KindedEvent[] {
  const out: KindedEvent[] = []
  for (const r of raw) {
    if (r.declined && !useUI.getState().calPrefs.showDeclined) continue
    const s = new Date(r.start)
    const e = new Date(r.end)
    if (r.allDay) {
      out.push({
        id: r.id,
        date: dayKey(s),
        day: weekdayIndex(s),
        start: 0,
        end: 0,
        title: r.title,
        sub: r.location ? `All day · ${r.location}` : 'All day',
        kind: kindFor(r.calendar),
        allDay: true
      })
      continue
    }
    const start = s.getHours() + s.getMinutes() / 60
    // Events that run past midnight stop at the end of their first day.
    const end = e.getDate() === s.getDate() ? e.getHours() + e.getMinutes() / 60 : 24
    out.push({
      id: r.id,
      date: dayKey(s),
      day: weekdayIndex(s),
      start,
      end: Math.max(end, start + 0.25),
      title: r.title,
      sub: `${hh(start)}–${hh(end)}${r.location ? ` · ${r.location}` : ` · ${r.calendar}`}`,
      kind: kindFor(r.calendar)
    })
  }
  return out
}

/* ---------------- recurrence ---------------- */

const WEEKDAY_CODE: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 }

type Rule = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number
  byDay: number[]
  until: Date | null
}

/**
 * Only the shapes Nexday can create (and simple external ones) are expanded: daily, weekly and
 * monthly, with an optional interval, BYDAY and UNTIL. Everything else is shown once.
 * Recurring Mac events already arrive expanded from EventKit.
 */
function parseRule(text?: string | null): Rule | null {
  if (!text) return null
  const parts: Record<string, string> = {}
  for (const bit of text.split(';')) {
    const [k, v] = bit.split('=')
    if (k && v) parts[k.toUpperCase()] = v
  }
  const freq = parts.FREQ
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') return null
  const until = parts.UNTIL
    ? parts.UNTIL.length === 8
      ? new Date(
          Number(parts.UNTIL.slice(0, 4)),
          Number(parts.UNTIL.slice(4, 6)) - 1,
          Number(parts.UNTIL.slice(6, 8))
        )
      : new Date(parts.UNTIL)
    : null
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    byDay: (parts.BYDAY ?? '')
      .split(',')
      .map((d) => WEEKDAY_CODE[d.replace(/^[-+]?\d+/, '')] ?? WEEKDAY_CODE[d])
      .filter((n): n is number => n !== undefined),
    until: until && !Number.isNaN(until.getTime()) ? until : null
  }
}

const DAY_MS = 86400000
const daysBetween = (a: Date, b: Date): number =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)

function matchesRule(rule: Rule, base: Date, d: Date): boolean {
  const diff = daysBetween(base, d)
  if (diff < 0) return false
  if (rule.freq === 'DAILY') return diff % rule.interval === 0
  if (rule.freq === 'WEEKLY') {
    const dayOk = rule.byDay.length
      ? rule.byDay.includes(weekdayIndex(d))
      : weekdayIndex(d) === weekdayIndex(base)
    return dayOk && Math.floor(diff / 7) % rule.interval === 0
  }
  const months = (d.getFullYear() - base.getFullYear()) * 12 + (d.getMonth() - base.getMonth())
  return months % rule.interval === 0 && d.getDate() === base.getDate()
}

function occurrenceDates(ev: PlanEvent, range: Range | null): string[] {
  const base = startOfDay(new Date(ev.startsAt))
  const rule = parseRule(ev.rrule)
  if (!rule) return [dayKey(base)]
  const from = range ? parseDayKey(range.from) : base
  const to = range ? parseDayKey(range.to) : addDays(base, 365)
  const out: string[] = []
  for (let d = startOfDay(from < base ? base : from); d <= to; d = addDays(d, 1)) {
    if (rule.until && d > rule.until) break
    if (matchesRule(rule, base, d)) out.push(dayKey(d))
  }
  return out
}

function ownToDisplay(events: PlanEvent[], range: Range | null): KindedEvent[] {
  const out: KindedEvent[] = []
  for (const ev of events) {
    const s = new Date(ev.startsAt)
    const e = new Date(ev.endsAt)
    const allDay = !!ev.allDay
    const start = allDay ? 0 : s.getHours() + s.getMinutes() / 60
    const end = allDay ? 0 : e.getDate() === s.getDate() ? e.getHours() + e.getMinutes() / 60 : 24
    const recurring = !!parseRule(ev.rrule)
    for (const date of occurrenceDates(ev, range)) {
      if (range && (date < range.from || date > range.to)) continue
      out.push({
        id: recurring ? `${ev.id}@${date}` : ev.id,
        sourceId: ev.id,
        date,
        day: weekdayIndex(parseDayKey(date)),
        start,
        end: allDay ? 0 : Math.max(end, start + 0.25),
        title: ev.title,
        sub: allDay
          ? `All day${ev.location ? ` · ${ev.location}` : ''}`
          : `${hh(start)}–${hh(end)}${ev.location ? ` · ${ev.location}` : ''}`,
        kind: ev.kind,
        allDay
      })
    }
  }
  return out
}

const merge = (base: KindedEvent[], own: PlanEvent[], range: Range | null): KindedEvent[] => {
  // An event we wrote to Mac Calendar comes back in `base` too; show the Nexday copy only.
  const external = new Set(own.map((e) => e.externalId).filter((id): id is string => !!id))
  const ownDisplay = ownToDisplay(own, range)
  // Matching by id is the normal path; title+date+start covers occurrences whose EventKit id
  // differs from the master event's id.
  const written = new Set(
    own
      .filter((e) => e.externalId)
      .flatMap((e) => ownDisplay.filter((d) => d.sourceId === e.id))
      .map((d) => `${d.date}|${d.title}|${d.start}`)
  )
  const cleanBase = base.filter(
    (e) => !external.has(e.id) && !written.has(`${e.date}|${e.title}|${e.start}`)
  )
  return [...cleanBase, ...ownDisplay]
}

/** The sample week only exists while it is the current week; other weeks show what was saved. */
function sampleBase(range: Range): KindedEvent[] {
  const start = startOfWeek(appToday())
  return sampleWeekEvents(start).filter((e) => e.date >= range.from && e.date <= range.to)
}

const isErr = (v: unknown): v is { error: string } =>
  typeof v === 'object' && v !== null && 'error' in v

async function loadStatus(): Promise<AccessStatus> {
  if (!api) return 'unavailable'
  const r = await api.status()
  if (isErr(r)) return 'unavailable'
  return (r as { status: AccessStatus }).status
}

export const useCalendar = create<CalendarState>((set, get) => {
  /** Load Mac events (or the sample week) for a date range, then merge Nexday events into it. */
  const loadRange = async (from: Date, to: Date): Promise<void> => {
    const range = { from: dayKey(from), to: dayKey(to) }
    set({ range })
    if (get().status !== 'authorized' || !api) {
      const base = sampleBase(range)
      set({ base, events: merge(base, get().own, range) })
      return
    }
    set({ busy: true })
    try {
      const evs = await api.events(from.getTime(), to.getTime())
      const base = isErr(evs) ? get().base : convert(evs as RawEvent[])
      set((s) => ({
        base,
        events: merge(base, s.own, range),
        live: !isErr(evs),
        lastSync: Date.now()
      }))
    } finally {
      set({ busy: false })
    }
  }

  /** When Mac Calendar is connected, the new event is written there too; its identifier is kept. */
  const pushToMac = async (id: string): Promise<void> => {
    if (!api?.create) return
    // "Calendar to Nexday" only reads: nothing is written back to the Mac.
    if (useUI.getState().calPrefs.syncDirection !== 'Two-way') return
    const status = get().status === 'unknown' ? await loadStatus() : get().status
    if (status !== 'authorized') return
    const ev = get().own.find((e) => e.id === id)
    if (!ev) return
    const res = await api.create({
      title: ev.title,
      startMs: new Date(ev.startsAt).getTime(),
      endMs: new Date(ev.endsAt).getTime(),
      allDay: !!ev.allDay,
      location: ev.location ?? null,
      rrule: ev.rrule ?? null
    })
    if (isErr(res) || !res) return
    const externalId = (res as { id?: unknown }).id
    if (typeof externalId !== 'string' || !externalId) return
    set((s) => ({ own: s.own.map((e) => (e.id === id ? { ...e, externalId } : e)) }))
  }

  return {
    status: 'unknown',
    base: [],
    own: [],
    events: [],
    live: false,
    calendars: [],
    lastSync: null,
    busy: false,
    weekStart: startOfWeek(appToday()),
    day: dayKey(appToday()),
    month: startOfMonth(appToday()),
    range: null,
    refresh: async () => {
      const status = await loadStatus()
      set({ status })
      const r = get().range
      const from = r ? parseDayKey(r.from) : get().weekStart
      const to = r ? parseDayKey(r.to) : addDays(get().weekStart, 6)
      await loadRange(from, to)
      if (status === 'authorized' && api) {
        const cals = await api.calendars()
        if (!isErr(cals)) set({ calendars: cals as MacCalendar[] })
      }
    },
    connect: async () => {
      if (!api || get().busy) return
      set({ busy: true })
      try {
        await api.request()
      } finally {
        set({ busy: false })
      }
      set({ status: await loadStatus() })
      await get().refresh()
    },
    loadWeek: async (start) => {
      const monday = startOfWeek(start)
      set({ weekStart: monday })
      await loadRange(monday, addDays(monday, 6))
    },
    loadMonth: async (cursor) => {
      const month = startOfMonth(cursor)
      const first = new Date(month.getFullYear(), month.getMonth(), 1)
      const lead = (first.getDay() + 6) % 7
      const gridStart = addDays(first, -lead)
      set({ month })
      await loadRange(gridStart, addDays(gridStart, 41))
    },
    loadSpan: async (from, days) => {
      const start = startOfDay(from)
      await loadRange(start, addDays(start, days - 1))
    },
    setDay: async (date) => {
      set({ day: date })
      await get().loadWeek(parseDayKey(date))
    },
    add: ({ title, date, start, end, kind: given, location, allDay, rrule }) => {
      const pref = useUI.getState().calPrefs.newEventCalendar
      const kind: EventKind = given ?? (pref === 'Work' ? 'work' : pref === 'Planner MVP' ? 'acc' : 'personal')
      const day = parseDayKey(date)
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      const starts = allDay
        ? new Date(day.getFullYear(), day.getMonth(), day.getDate())
        : new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh || 0, sm || 0)
      let ends = allDay
        ? new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
        : new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh || 0, em || 0)
      if (!allDay && ends.getTime() <= starts.getTime()) ends = new Date(starts.getTime() + 3600000)
      const id = crypto.randomUUID()
      set((s) => {
        const own: PlanEvent[] = [
          ...s.own,
          {
            id,
            title,
            startsAt: starts.toISOString(),
            endsAt: ends.toISOString(),
            kind,
            location: location ?? null,
            allDay: !!allDay,
            rrule: rrule ?? null,
            externalId: null
          }
        ]
        return { own, events: merge(s.base, own, s.range) }
      })
      void pushToMac(id)
      return id
    },
    move: (id, date, startMin) => {
      const ev = get().own.find((e) => e.id === id)
      // Recurring and all-day events are moved from their editor, not by dragging.
      if (!ev || ev.rrule || ev.allDay) return
      const length = new Date(ev.endsAt).getTime() - new Date(ev.startsAt).getTime()
      const day = parseDayKey(date)
      const starts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(startMin / 60), startMin % 60)
      const ends = new Date(starts.getTime() + length)
      set((s) => {
        const own = s.own.map((e) =>
          e.id === id ? { ...e, startsAt: starts.toISOString(), endsAt: ends.toISOString() } : e
        )
        return { own, events: merge(s.base, own, s.range) }
      })
      if (ev.externalId && api?.update && useUI.getState().calPrefs.syncDirection === 'Two-way')
        void api.update(ev.externalId, starts.getTime(), ends.getTime())
    },
    remove: (id) => {
      const ev = get().own.find((e) => e.id === id)
      set((s) => {
        const own = s.own.filter((e) => e.id !== id)
        return { own, events: merge(s.base, own, s.range) }
      })
      if (ev?.externalId && api?.remove) void api.remove(ev.externalId)
    },
    setOwn: (own) => set((s) => ({ own, events: merge(s.base, own, s.range) })),
    reset: () =>
      set({
        base: [],
        own: [],
        events: [],
        live: false,
        calendars: [],
        lastSync: null,
        range: null,
        weekStart: startOfWeek(appToday()),
        day: dayKey(appToday()),
        month: startOfMonth(appToday())
      })
  }
})
