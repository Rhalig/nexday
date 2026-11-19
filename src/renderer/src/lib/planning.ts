import type { KindedEvent } from '../data/calendar'
import type { Task, TaskGroup } from '../data/tasks'
import type { PlanSettings } from '../store/ui'
import {
  addDays,
  appToday,
  dayKey,
  daysFromToday,
  parseDayKey,
  weekdayIndex,
  weekdayShort
} from './clock'

export type Placement = {
  id: string
  title: string
  project: Task['project']
  energy: Task['energy']
  lengthMin: number
  date: string
  start: string
  end: string
  group: 'today' | 'tomorrow' | 'next-week'
  /** In the tasks store's format */
  time: string
  /** "Today 14:30 – 15:00" */
  when: string
  note: string
}

export type PlanResult = { date: string; placements: Placement[]; skipped: number }

type Gap = { start: number; end: number }

const WORK_START = 9 * 60
const WORK_END = 18 * 60
const MORNING_END = 12 * 60

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const fromMin = (n: number): string =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.round(n % 60)).padStart(2, '0')}`

const fmtLen = (n: number): string =>
  n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}` : `${n}m`

/** "09:30 · 30m" → 570 (start) and 30 (minutes), or null. */
function parseTaskTime(time: string | null): { start: number; len: number } | null {
  if (!time) return null
  const m = time.match(/^(\d{2}:\d{2}) · (?:(\d+)h)?\s?(?:(\d+)m)?$/)
  if (!m) return null
  return { start: toMin(m[1]), len: Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) }
}

function subtract(gaps: Gap[], start: number, end: number, buffer: number): Gap[] {
  const out: Gap[] = []
  for (const g of gaps) {
    if (end <= g.start || start >= g.end) {
      out.push(g)
      continue
    }
    const leftEnd = start - buffer
    if (leftEnd > g.start) out.push({ start: g.start, end: leftEnd })
    const rightStart = end + buffer
    if (rightStart < g.end) out.push({ start: rightStart, end: g.end })
  }
  return out
}

function freeGaps(busy: Gap[], buffer: number, from: number): Gap[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start)
  const gaps: Gap[] = []
  let cursor = Math.max(WORK_START, from)
  for (const b of sorted) {
    const start = Math.max(WORK_START, b.start - buffer)
    const end = Math.min(WORK_END, b.end + buffer)
    if (start - cursor >= 15) gaps.push({ start: cursor, end: Math.min(start, WORK_END) })
    cursor = Math.max(cursor, end)
  }
  if (WORK_END - cursor >= 15) gaps.push({ start: cursor, end: WORK_END })
  return gaps
}

/** The first gap with room for `len`; deep work prefers the morning, light the afternoon. */
function take(gaps: Gap[], len: number, energy: Task['energy'], useEnergy: boolean): number | null {
  if (!useEnergy) {
    const g = gaps.find((x) => x.end - x.start >= len)
    return g ? g.start : null
  }
  for (const g of gaps) {
    if (energy === 'Deep focus') {
      const s = Math.max(g.start, WORK_START)
      if (s + len <= Math.min(g.end, MORNING_END)) return s
    } else {
      const s = Math.max(g.start, MORNING_END)
      if (s + len <= g.end) return s
    }
  }
  // No preferred slot: use any gap that fits.
  for (const g of gaps) if (g.end - g.start >= len) return g.start
  return null
}

const habitLen = (label: string): number => {
  const h = label.match(/(\d+)\s*h/)
  const m = label.match(/(\d+)\s*m/)
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0) || 5
}

/** Days ahead that can be planned: weekday labels ("Fri 09:30") stay unambiguous inside it. */
export const PLAN_HORIZON = 8

/** The date a task already sits on, from its group and time label. */
function dateOfScheduled(group: TaskGroup['id'], time: string | null): string | null {
  if (!time) return null
  if (group === 'today') return dayKey(appToday())
  if (group === 'tomorrow') return dayKey(addDays(appToday(), 1))
  if (group !== 'next-week') return null
  const wd = time.split(' ')[0]
  const idx = WEEKDAY_NAMES.indexOf(wd)
  if (idx < 0) return null
  for (let i = 2; i <= PLAN_HORIZON; i++) {
    const d = addDays(appToday(), i)
    if (weekdayIndex(d) === idx) return dayKey(d)
  }
  return null
}
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "09:30 · 30m" or "Mon 09:30" → start minute and length (the task's own estimate, else the default). */
function slotOf(t: Task, defaultLen: number): { start: number; len: number } | null {
  if (!t.time) return null
  const own = parseTaskTime(t.time)
  if (own) return { start: own.start, len: own.len || t.estimate || defaultLen }
  const m = t.time.match(/(\d{2}:\d{2})$/)
  return m ? { start: toMin(m[1]), len: t.estimate || defaultLen } : null
}

/**
 * Fits the open (no-time) tasks into the coming work days, starting now: work days, lunch,
 * buffers, habits, the energy curve and the daily deep-focus cap from Settings › Planning. Each
 * task takes its own estimate (the default length when it has none). A day that fills up hands
 * the rest to the next work day. `skipped` counts tasks that fit nowhere in the horizon.
 */
export function planTasks(
  openTasks: Task[],
  groups: TaskGroup[],
  events: KindedEvent[],
  settings: PlanSettings,
  habits: Array<{ time: string; length: string }> = [],
  now: Date = appToday()
): PlanResult {
  const nowMin = now.getHours() * 60 + now.getMinutes()

  // What already sits on each day.
  const taken = new Map<string, Array<{ start: number; len: number; deep: boolean }>>()
  for (const g of groups) {
    if (g.id === 'no-time') continue
    for (const t of g.tasks) {
      const date = dateOfScheduled(g.id, t.time)
      const slot = slotOf(t, settings.defaultLength)
      if (!date || !slot) continue
      const list = taken.get(date) ?? []
      list.push({ ...slot, deep: t.energy === 'Deep focus' })
      taken.set(date, list)
    }
  }

  const queue = [...openTasks]
  if (settings.useEnergy)
    queue.sort((a, b) => (a.energy === b.energy ? 0 : a.energy === 'Deep focus' ? -1 : 1))
  const lenOf = (t: Task): number => t.estimate || settings.defaultLength
  const deepCap = settings.deepFocusHours * 60

  const placements: Placement[] = []
  const placed = new Set<string>()
  for (let i = 0; i <= PLAN_HORIZON && placed.size < queue.length; i++) {
    const target = addDays(now, i)
    if (!settings.workDays[weekdayIndex(target)]) continue
    const date = dayKey(target)
    const group: Placement['group'] = i === 0 ? 'today' : i === 1 ? 'tomorrow' : 'next-week'

    const busy: Gap[] = []
    for (const e of events) {
      if (e.date !== date || e.allDay) continue
      busy.push({ start: e.start * 60, end: e.end * 60 })
    }
    let deepUsed = 0
    for (const t of taken.get(date) ?? []) {
      busy.push({ start: t.start, end: t.start + t.len })
      if (t.deep) deepUsed += t.len
    }
    busy.push({ start: toMin(settings.lunchStart), end: toMin(settings.lunchEnd) })
    if (settings.reserveHabits) {
      for (const h of habits) {
        const start = toMin(h.time)
        busy.push({ start, end: start + habitLen(h.length) })
      }
    }

    // Today starts at the next quarter hour: nothing is placed in the past.
    const from = i === 0 ? Math.ceil((nowMin + settings.buffer) / 15) * 15 : 0
    let gaps = freeGaps(busy, settings.buffer, from)

    for (const t of queue) {
      if (placed.has(t.id)) continue
      const len = lenOf(t)
      if (settings.useEnergy && t.energy === 'Deep focus' && deepUsed + len > deepCap) continue
      const slot = take(gaps, len, t.energy, settings.useEnergy)
      if (slot === null) continue
      gaps = subtract(gaps, slot, slot + len, settings.buffer)
      if (t.energy === 'Deep focus') deepUsed += len
      placed.add(t.id)
      const start = fromMin(slot)
      const end = fromMin(slot + len)
      const label =
        i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${weekdayShort(target)} ${target.getDate()}`
      placements.push({
        id: t.id,
        title: t.title,
        project: t.project,
        energy: t.energy,
        lengthMin: len,
        date,
        start,
        end,
        group,
        time:
          group === 'next-week' ? `${weekdayShort(target)} ${start}` : `${start} · ${fmtLen(len)}`,
        when: `${label} ${start} – ${end}`,
        note:
          settings.useEnergy && t.energy === 'Deep focus'
            ? 'Morning focus hours'
            : settings.useEnergy
              ? 'Afternoon light work'
              : 'First open gap'
      })
    }
  }
  placements.sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)))
  return {
    date: placements[0]?.date ?? dayKey(now),
    placements,
    skipped: queue.length - placed.size
  }
}

export const planDayLabel = (date: string): string => {
  const d = parseDayKey(date)
  const diff = daysFromToday(d)
  return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `${weekdayShort(d)} ${d.getDate()}`
}
