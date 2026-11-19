import type { TaskGroup } from '../data/tasks'
import { useTasks } from '../store/tasks'
import { addDays, appToday, weekdayIndex, weekdayShort } from './clock'
import { parseTime } from './today'

const fmtLen = (len: number): string =>
  len >= 60 ? `${Math.floor(len / 60)}h${len % 60 ? ` ${len % 60}m` : ''}` : `${len}m`

/** The clock time ("HH:MM") a task currently has, or null when it has none. */
export function clockOf(time: string | null): string | null {
  const old = parseTime(time)
  if (old) return `${String(Math.floor(old.start / 60)).padStart(2, '0')}:${String(old.start % 60).padStart(2, '0')}`
  return time?.match(/(\d{2}:\d{2})$/)?.[1] ?? null
}

/** The length in minutes a task has: from its slot, its estimate, or 30. */
export function lengthOf(time: string | null, estimate?: number): number {
  return parseTime(time)?.len ?? estimate ?? 30
}

/**
 * Puts a task in a day group. It keeps its clock time and length unless told otherwise;
 * "No time yet" clears them.
 */
export function placeTask(id: string, group: TaskGroup['id'], opts: { clock?: string; len?: number } = {}): void {
  const hit = useTasks.getState().groups.flatMap((g) => g.tasks).find((t) => t.id === id)
  if (!hit) return
  const clock = opts.clock ?? clockOf(hit.time) ?? '09:00'
  const len = opts.len ?? lengthOf(hit.time, hit.estimate)
  let time: string | null = null
  if (group === 'today' || group === 'tomorrow') time = `${clock} · ${fmtLen(len)}`
  else if (group === 'next-week') {
    // The next Monday that is at least two days away reads as "next week".
    let label = 'Mon'
    for (let i = 2; i <= 8; i++) {
      const d = addDays(appToday(), i)
      if (weekdayIndex(d) === 0) label = weekdayShort(d)
    }
    time = `${label} ${clock}`
  }
  useTasks.getState().move(id, group, time)
  if (opts.len) useTasks.getState().patch(id, { estimate: opts.len })
}

/** Dropping a task on a day keeps its clock time and length; "No time yet" clears them. */
export function moveToGroup(id: string, group: TaskGroup['id']): void {
  placeTask(id, group)
}
