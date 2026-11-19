import { aiParseCapture, minutesFrom, splitWhen } from './ai'
import { parseCapture, slotFor, toTask } from './capture'
import { useTasks } from '../store/tasks'

/**
 * Adds a task from a line of text at once (the regex reads day, time, length and #project), then lets the
 * AI fill in only what the words did not give: the day and time, the project, the energy, and a cleaner
 * title when nothing at all was recognised. It never overrides something the person wrote explicitly.
 */
export function captureTask(text: string): void {
  const p = parseCapture(text)
  const { task, group } = toTask(p)
  const store = useTasks.getState()
  store.add(task, group)

  void aiParseCapture(text).then((r) => {
    if ('error' in r || r.data.kind !== 'task') return
    const a = r.data
    // A cleaner title only when the words held something the regex missed (a day it does not know, or
    // nothing at all) and the AI kept the person's own words rather than rewording or translating.
    const nothingRead = p.group === 'no-time' && !p.project && !p.time
    const dayMissed = !p.dayWord && !!a.date
    const words = new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    const keepsWords = (a.title.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).some((w) => words.has(w))
    const title =
      (nothingRead || dayMissed) && a.title.trim() && keepsWords ? a.title.trim().slice(0, 200) : undefined
    const energy = a.energy === 'Deep focus' || a.energy === 'Light' ? a.energy : undefined
    useTasks.getState().patch(task.id, {
      ...(title ? { title } : {}),
      ...(!p.project && a.project ? { project: a.project } : {}),
      ...(energy ? { energy } : {})
    })
    // The words named no day: take the AI's date (and its time, unless the words gave one).
    if (!p.dayWord && (a.date || (!p.time && a.start))) {
      const start = p.time ?? a.start
      const minutes = p.length ?? (a.start && a.end ? minutesBetween(a.start, a.end) : null)
      const slot = slotFor(splitWhen(a.date ?? '').date, start ? splitWhen(start).time : null, minutes)
      if (slot.group !== 'no-time') useTasks.getState().move(task.id, slot.group, slot.time)
    }
  })
}

const minutesBetween = (start: string, end: string): number | null => {
  const m = (v: string): number => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5))
  const n = m(end) - m(start)
  return minutesFrom(`${n}m`)
}
