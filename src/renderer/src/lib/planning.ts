import type { KindedEvent } from '../data/calendar'
import type { Task } from '../data/tasks'
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

function freeGaps(busy: Gap[], buffer: number): Gap[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start)
  const gaps: Gap[] = []
  let cursor = WORK_START + buffer
  for (const b of sorted) {
    const start = Math.max(WORK_START, b.start - buffer)
    const end = Math.min(WORK_END, b.end + buffer)
    if (start - cursor >= 15) gaps.push({ start: cursor, end: start })
    cursor = Math.max(cursor, end)
  }
  if (WORK_END - buffer - cursor >= 15) gaps.push({ start: cursor, end: WORK_END - buffer })
  return gaps.length ? gaps : cursor < WORK_END ? [{ start: cursor, end: WORK_END }] : []
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

/**
 * Fits the open (no-time) tasks into one work day: work days, lunch, buffers, the energy curve and
 * the daily deep-focus cap from Settings › Planning. Returns what to place and how many tasks did
 * not fit.
 */
const habitLen = (label: string): number => {
  const h = label.match(/(\d+)\s*h/)
  const m = label.match(/(\d+)\s*m/)
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0) || 5
}

export function planTasks(
  openTasks: Task[],
  todayTasks: Task[],
  events: KindedEvent[],
  settings: PlanSettings,
  habits: Array<{ time: string; length: string }> = []
): PlanResult {
  const today = appToday()
  let target: Date | null = null
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i)
    if (settings.workDays[weekdayIndex(d)]) {
      target = d
      break
    }
  }
  if (!target) return { date: dayKey(today), placements: [], skipped: openTasks.length }
  const diff = daysFromToday(target)
  const date = dayKey(target)
  const group: Placement['group'] = diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : 'next-week'

  const busy: Gap[] = []
  for (const e of events) {
    if (e.date !== date || e.allDay) continue
    busy.push({ start: e.start * 60, end: e.end * 60 })
  }
  // The day's own timed tasks occupy their slots too.
  let deepUsed = 0
  for (const t of diff === 0 ? todayTasks : []) {
    const p = parseTaskTime(t.time)
    if (!p) continue
    busy.push({ start: p.start, end: p.start + p.len })
    if (t.energy === 'Deep focus') deepUsed += p.len
  }
  busy.push({ start: toMin(settings.lunchStart), end: toMin(settings.lunchEnd) })
  if (settings.reserveHabits) {
    for (const h of habits) {
      const start = toMin(h.time)
      busy.push({ start, end: start + habitLen(h.length) })
    }
  }

  let gaps = freeGaps(busy, settings.buffer)
  const queue = [...openTasks]
  if (settings.useEnergy)
    queue.sort((a, b) => (a.energy === b.energy ? 0 : a.energy === 'Deep focus' ? -1 : 1))

  const deepCap = settings.deepFocusHours * 60
  const placements: Placement[] = []
  let skipped = 0
  for (const t of queue) {
    const len = settings.defaultLength
    if (settings.useEnergy && t.energy === 'Deep focus' && deepUsed + len > deepCap) {
      skipped++
      continue
    }
    const slot = take(gaps, len, t.energy, settings.useEnergy)
    if (slot === null) {
      skipped++
      continue
    }
    gaps = subtract(gaps, slot, slot + len, settings.buffer)
    if (t.energy === 'Deep focus') deepUsed += len
    const start = fromMin(slot)
    const end = fromMin(slot + len)
    const label =
      diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${weekdayShort(target)} ${target.getDate()}`
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
  return { date, placements, skipped }
}

export const planDayLabel = (date: string): string => {
  const d = parseDayKey(date)
  const diff = daysFromToday(d)
  return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `${weekdayShort(d)} ${d.getDate()}`
}
