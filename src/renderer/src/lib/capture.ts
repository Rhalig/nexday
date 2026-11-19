import type { Project, Task, TaskGroup } from '../data/tasks'
import { useProjects } from '../store/projects'
import { daysFromToday, parseDayKey, weekdayShort } from './clock'

const projectTags: Record<Project, string[]> = {
  planner: ['planner', 'planner-mvp', 'mvp', 'work'],
  moving: ['moving', 'moving-house', 'house'],
  reading: ['reading', 'reading-list', 'book', 'books'],
  personal: ['personal']
}

const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const dayLabel: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

export type Parsed = {
  title: string
  project: Project | null
  group: TaskGroup['id']
  time: string | null
  weekday: string | null
  /** Minutes, when the text says how long ('45m', 'for 1h') */
  length: number | null
  /** True when the text named a day (today, tomorrow, a weekday, next week) */
  dayWord: boolean
}

/** Pulls #project, a time (14:30) and a day (today, tomorrow, mon…, next week) out of plain text. */
export function parseCapture(input: string): Parsed {
  let text = ` ${input.trim()} `
  let project: Project | null = null
  let time: string | null = null
  let weekday: string | null = null
  let day: 'today' | 'tomorrow' | 'week' | null = null
  let length: number | null = null

  text = text.replace(/\s#([\w-]+)/g, (m, tag: string) => {
    const t = tag.toLowerCase()
    const hit =
      (Object.keys(projectTags) as Project[]).find((p) => projectTags[p].includes(t)) ??
      // a project the person created: #deneme or #my-project
      useProjects.getState().custom.find((c) => c.slug === t || c.name.toLowerCase().replace(/\s+/g, '-') === t)?.slug
    if (!hit) return m
    project = hit
    return ' '
  })
  text = text.replace(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i, (_m, h: string, mm: string) => {
    time = `${h.padStart(2, '0')}:${mm}`
    return ' '
  })
  text = text.replace(/\s(?:for\s+)?(\d{1,3})\s?(h|hr|hrs|hours?|m|min|mins|minutes?)(?=\s)/i, (_m, n: string, u: string) => {
    length = Number(n) * (u.toLowerCase().startsWith('h') ? 60 : 1)
    return ' '
  })
  text = text.replace(/\s(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?=\s)/i, (_m, w: string) => {
    const k = w.toLowerCase()
    if (k === 'today') day = 'today'
    else if (k === 'tomorrow') day = 'tomorrow'
    else if (k === 'next week') day = 'week'
    else {
      day = 'week'
      weekday = k.slice(0, 3)
    }
    return ' '
  })

  const title = text.replace(/\s+/g, ' ').trim()
  const cleaned = title ? title[0].toUpperCase() + title.slice(1) : input.trim()
  let group: TaskGroup['id']
  if (day === 'today') group = 'today'
  else if (day === 'tomorrow') group = 'tomorrow'
  else if (day === 'week') group = 'next-week'
  else group = time ? 'today' : 'no-time'
  return { title: cleaned, project, group, time, weekday, length, dayWord: day !== null }
}

export const fmtLen = (n: number): string =>
  n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}` : `${n}m`

/** New items get their final id immediately, so saving them never renames anything. */
export const newId = (_prefix = ''): string => crypto.randomUUID()

/** The Task row for a parsed capture, ready for the tasks store. */
export function toTask(p: Parsed, fallbackProject: Project = 'personal'): { task: Task; group: TaskGroup['id'] } {
  let time: string | null = null
  if (p.group === 'next-week') {
    const d = p.weekday ? dayLabel[p.weekday] : 'Mon'
    time = `${d} ${p.time ?? '09:00'}`
  } else if (p.group !== 'no-time') {
    time = `${p.time ?? '09:00'} · ${fmtLen(p.length ?? 30)}`
  }
  return {
    task: {
      id: newId('t'),
      title: p.title,
      project: p.project ?? fallbackProject,
      energy: 'Light',
      time,
      ...(p.length ? { estimate: p.length } : {})
    },
    group: p.group
  }
}

export { weekdays }

/**
 * Where a day + clock time (+ length) lands in the task groups. A date with no time means 09:00;
 * a time with no date means today; neither means "No time yet".
 */
export function slotFor(
  date: string | null,
  start: string | null,
  minutes: number | null
): { group: TaskGroup['id']; time: string | null } {
  const diff = date ? daysFromToday(parseDayKey(date)) : start ? 0 : null
  const group: TaskGroup['id'] =
    diff === null ? 'no-time' : diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : 'next-week'
  const at = start ?? '09:00'
  const time =
    group === 'no-time'
      ? null
      : group === 'next-week'
        ? `${weekdayShort(parseDayKey(date!))} ${at}`
        : `${at} · ${fmtLen(minutes ?? 30)}`
  return { group, time }
}
