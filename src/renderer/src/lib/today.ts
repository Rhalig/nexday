import type { KindedEvent } from '../data/calendar'
import type { Project, Task, TaskGroup } from '../data/tasks'
import type { DoneTask } from '../store/tasks'

/** Everything the Today page shows, worked out from the real stores. Pure, so it is easy to check. */

export const DAY_START = 7 * 60
export const DAY_END = 23 * 60
const WORK_START = 9 * 60
const WORK_END = 18 * 60
const MIN_GAP = 60

export type StripKind = 'health' | 'work' | 'personal' | 'moved' | 'free'

export type StripItem = {
  key: string
  kind: StripKind
  title: string
  hint: string
  /** minutes from midnight */
  start: number
  end: number
}

export type PlanTask = {
  id: string
  title: string
  project: Project
  time: string
  done?: boolean
  hot?: boolean
  /** "8:40" for finished tasks */
  doneAt?: string
  /** Length in minutes (the task's own, else 30), for dragging */
  len?: number
}
export type PlanGroup = { id: string; title: string; link?: string; tasks: PlanTask[] }

export type Gap = { start: number; end: number }

export type TodayData = {
  eventCount: number
  openCount: number
  doneCount: number
  total: number
  score: number | null
  focusMin: number
  strip: StripItem[]
  gaps: Gap[]
  legend: Array<{ color: string; label: string }>
  plan: PlanGroup[]
  /** Open tasks with a start time, for the timeline view */
  timed: Array<{ id: string; title: string; start: number; end: number }>
  unscheduled: PlanTask[]
  upNext: { title: string; meta: string; inMin: number; kind: 'event' | 'task' } | null
  noTimeCount: number
}

const pad = (n: number): string => String(n).padStart(2, '0')
export const clock = (min: number): string => `${pad(Math.floor(min / 60))}:${pad(Math.round(min % 60))}`
export const fmtMin = (n: number): string => {
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}

/** "09:30 · 30m" → start and length in minutes, or null. */
export function parseTime(time: string | null): { start: number; len: number } | null {
  if (!time) return null
  const m = time.match(/^(\d{2}):(\d{2}) · (?:(\d+)h)?\s?(?:(\d+)m)?$/)
  if (!m) return null
  const len = Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)
  return { start: Number(m[1]) * 60 + Number(m[2]), len: len || 30 }
}

const stripKind = (k: KindedEvent['kind']): StripKind =>
  k === 'health'
    ? 'health'
    : k === 'personal'
      ? 'personal'
      : k === 'work' || k === 'blue'
        ? 'work'
        : 'moved'

/** Free stretches of at least an hour inside the work window, from `from` onwards. */
function freeGaps(busy: Gap[], from: number): Gap[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start)
  const out: Gap[] = []
  let cursor = Math.max(WORK_START, from)
  for (const b of sorted) {
    if (b.start - cursor >= MIN_GAP) out.push({ start: cursor, end: Math.min(b.start, WORK_END) })
    cursor = Math.max(cursor, b.end)
  }
  if (WORK_END - cursor >= MIN_GAP) out.push({ start: cursor, end: WORK_END })
  return out.filter((g) => g.end - g.start >= MIN_GAP)
}

const doneClock = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getHours()}:${pad(d.getMinutes())}`
}

export function buildToday(input: {
  /** Events whose date is today, all-day ones included */
  events: KindedEvent[]
  groups: TaskGroup[]
  done: DoneTask[]
  now: Date
}): TodayData {
  const nowMin = input.now.getHours() * 60 + input.now.getMinutes()
  const timedEvents = input.events
    .filter((e) => !e.allDay)
    .sort((a, b) => a.start - b.start)
    .map((e) => ({ e, start: Math.round(e.start * 60), end: Math.round(e.end * 60) }))

  const todayTasks: Task[] = input.groups.find((g) => g.id === 'today')?.tasks ?? []
  const noTimeCount = input.groups.find((g) => g.id === 'no-time')?.tasks.length ?? 0

  const timed = todayTasks
    .map((t) => ({ t, p: parseTime(t.time) }))
    .filter((x): x is { t: Task; p: { start: number; len: number } } => x.p !== null)
    .map(({ t, p }) => ({ id: t.id, title: t.title, start: p.start, end: p.start + p.len }))
    .sort((a, b) => a.start - b.start)
  const timedIds = new Set(timed.map((t) => t.id))

  // --- plan list
  const nextTask = timed.find((t) => t.end > nowMin)
  const openTasks: PlanTask[] = todayTasks.map((t) => {
    const p = parseTime(t.time)
    return {
      id: t.id,
      title: t.title,
      project: t.project,
      time: p ? clock(p.start) : '—',
      hot: nextTask?.id === t.id,
      len: p?.len ?? t.estimate ?? 30
    }
  })
  const doneTasks: PlanTask[] = input.done.map((d) => {
    const p = parseTime(d.time)
    return {
      id: d.id,
      title: d.title,
      project: d.project,
      time: p ? fmtMin(p.len) : '—',
      done: true,
      doneAt: doneClock(d.at)
    }
  })
  const startOf = new Map<string, number>()
  for (const t of todayTasks) startOf.set(t.id, parseTime(t.time)?.start ?? -1)
  for (const d of input.done) startOf.set(d.id, parseTime(d.time)?.start ?? -1)

  const defs: Array<{ id: string; title: string; from: number; to: number }> = [
    { id: 'morning', title: 'Morning', from: 0, to: 12 * 60 },
    { id: 'afternoon', title: 'Afternoon', from: 12 * 60, to: 18 * 60 },
    { id: 'evening', title: 'Evening', from: 18 * 60, to: 24 * 60 }
  ]
  const all = [...openTasks, ...doneTasks]
  const plan: PlanGroup[] = []
  for (const d of defs) {
    const tasks = all
      .filter((t) => {
        const s = startOf.get(t.id) ?? -1
        return s >= d.from && s < d.to
      })
      .sort((a, b) => (startOf.get(a.id) ?? 0) - (startOf.get(b.id) ?? 0))
    if (!tasks.length) continue
    const ev = timedEvents.find((x) => x.start >= d.from && x.start < d.to)
    plan.push({ id: d.id, title: d.title, link: ev ? `${ev.e.title} ${clock(ev.start)}` : undefined, tasks })
  }
  const anytime = all.filter((t) => (startOf.get(t.id) ?? -1) < 0)
  if (anytime.length) plan.push({ id: 'anytime', title: 'Anytime', tasks: anytime })

  // --- strip + gaps
  const busy: Gap[] = [
    ...timedEvents.map((x) => ({ start: x.start, end: x.end })),
    ...timed.map((t) => ({ start: t.start, end: t.end }))
  ]
  const gaps = freeGaps(busy, nowMin)
  const strip: StripItem[] = [
    ...timedEvents.map((x) => ({
      key: `e-${x.e.id}`,
      kind: stripKind(x.e.kind),
      title: x.e.title,
      hint: clock(x.start) + ' – ' + clock(x.end),
      start: x.start,
      end: x.end
    })),
    ...timed.map((t) => ({
      key: `t-${t.id}`,
      kind: 'moved' as const,
      title: t.title,
      hint: clock(t.start) + ' – ' + clock(t.end),
      start: t.start,
      end: t.end
    })),
    ...gaps.map((g) => ({
      key: `g-${g.start}`,
      kind: 'free' as const,
      title: `Free · ${fmtMin(g.end - g.start)}`,
      hint: '',
      start: g.start,
      end: g.end
    }))
  ]

  // --- numbers
  const minutes = (k: StripKind): number =>
    strip.filter((s) => s.kind === k && s.key.startsWith('e-')).reduce((n, s) => n + (s.end - s.start), 0)
  const deepOpen = todayTasks
    .filter((t) => t.energy === 'Deep focus')
    .reduce((n, t) => n + (parseTime(t.time)?.len ?? 0), 0)
  const deepDone = input.done
    .filter((t) => t.energy === 'Deep focus')
    .reduce((n, t) => n + (parseTime(t.time)?.len ?? 0), 0)
  const focusMin = deepOpen + deepDone
  const gapMin = gaps.reduce((n, g) => n + (g.end - g.start), 0)
  const legend = [
    { color: 'var(--acc)', label: 'Focus', min: focusMin },
    { color: 'var(--work)', label: 'Meetings', min: minutes('work') },
    { color: 'var(--health)', label: 'Health', min: minutes('health') },
    { color: 'var(--personal)', label: 'Personal', min: minutes('personal') },
    { color: '#CFCFCC', label: 'Free', min: gapMin }
  ]
    .filter((l) => l.min > 0)
    .map((l) => ({ color: l.color, label: `${l.label} ${fmtMin(l.min)}` }))

  const doneCount = input.done.length
  const openCount = todayTasks.length
  const total = doneCount + openCount

  // --- up next: the next event that has not started, else the next timed task
  const nextEvent = timedEvents.find((x) => x.start > nowMin)
  let upNext: TodayData['upNext'] = null
  if (nextEvent) {
    upNext = {
      title: nextEvent.e.title,
      meta: `${clock(nextEvent.start)}–${clock(nextEvent.end)}`,
      inMin: nextEvent.start - nowMin,
      kind: 'event'
    }
  } else {
    const nt = timed.find((t) => t.start > nowMin)
    if (nt)
      upNext = {
        title: nt.title,
        meta: `${clock(nt.start)}–${clock(nt.end)}`,
        inMin: nt.start - nowMin,
        kind: 'task'
      }
  }

  return {
    eventCount: input.events.length,
    openCount,
    doneCount,
    total,
    score: total ? Math.round((doneCount / total) * 100) : null,
    focusMin,
    strip,
    gaps,
    legend,
    plan,
    timed: timed.filter((t) => timedIds.has(t.id)),
    unscheduled: openTasks.filter((t) => !timedIds.has(t.id)),
    upNext,
    noTimeCount
  }
}

export const inText = (min: number): string =>
  min < 60 ? `in ${min} min` : `in ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`

/** Lane layout for overlapping strip items: each item gets a row index and the row count. */
export function layoutLanes(items: StripItem[]): Array<{ item: StripItem; lane: number; lanes: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const laneEnds: number[] = []
  const placed = sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = item.end
    return { item, lane }
  })
  const lanes = Math.min(3, Math.max(1, laneEnds.length))
  return placed.map((p) => ({ ...p, lane: Math.min(p.lane, lanes - 1), lanes }))
}
