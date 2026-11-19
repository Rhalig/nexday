import { useCalendar } from '../store/calendar'
import { useHabits } from '../store/habits'
import { useTasks } from '../store/tasks'
import { useUI } from '../store/ui'
import { appToday, dayKey, weekdayIndex } from './clock'
import { kv } from './persist'
import { T } from './prefs'
import { clock, parseTime } from './today'

/**
 * Desktop notifications (the "Push" column in Settings › Notifications). A timer checks every 30
 * seconds what is due and shows a native notification once. It respects pause, quiet hours, the
 * reminder lead time and each row's Push checkbox. Rows without a source yet (Inbox suggestions,
 * Shared notes) never fire.
 */

const ROW = { plan: 0, upNext: 1, tasksDue: 3, habits: 4, weekly: 5 } as const
const REMIND: Record<string, number> = {
  '5 minutes before': 5,
  '10 minutes before': 10,
  '30 minutes before': 30
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

let fired = new Set<string>()
let firedDay = ''

async function loadFired(day: string): Promise<void> {
  const saved = (await kv.get('notifFired')) as { day?: string; keys?: string[] } | null
  firedDay = day
  fired = saved?.day === day ? new Set(saved.keys ?? []) : new Set()
}
const saveFired = (): void => kv.set('notifFired', { day: firedDay, keys: [...fired] })

function show(title: string, body: string): void {
  if (typeof Notification === 'undefined') return
  const make = (): void => {
    try {
      new Notification(title, { body, silent: !useUI.getState().prefs.sounds })
    } catch (e) {
      console.warn('[notify]', e)
    }
  }
  if (Notification.permission === 'granted') make()
  else if (Notification.permission !== 'denied') void Notification.requestPermission().then((p) => p === 'granted' && make())
}

function inQuiet(mins: number, start: string, end: string): boolean {
  const a = toMin(start)
  const b = toMin(end)
  return a > b ? mins >= a || mins < b : mins >= a && mins < b
}

/** One pass: shows whatever is due right now. Exported so it can be driven in a test. */
export function checkNotifications(now: Date = appToday()): void {
  const ui = useUI.getState()
  if (ui.pauseNotifs) return
  const prefs = ui.notifPrefs
  const mins = now.getHours() * 60 + now.getMinutes()
  if (prefs.quietOn && inQuiet(mins, prefs.quietStart, prefs.quietEnd)) return
  const day = dayKey(now)
  if (day !== firedDay) {
    fired = new Set()
    firedDay = day
  }
  const push = (row: number): boolean => !!prefs.matrix[row]?.[0]
  const once = (key: string, title: string, body: string): void => {
    if (fired.has(key)) return
    fired.add(key)
    saveFired()
    show(title, body)
  }

  const cal = useCalendar.getState()
  const events = cal.events.filter(
    (e) => e.date === day && !e.allDay && (cal.status === 'authorized' || e.sourceId)
  )
  const todayTasks = useTasks.getState().groups.find((g) => g.id === 'today')?.tasks ?? []

  if (push(ROW.plan) && ui.planning.workDays[weekdayIndex(now)] && mins >= 510 && mins < 570) {
    const n = events.length
    once(
      `${day}|plan`,
      'Your day',
      `${n} ${n === 1 ? 'event' : 'events'} and ${todayTasks.length} ${todayTasks.length === 1 ? 'task' : 'tasks'} today.`
    )
  }

  if (push(ROW.upNext)) {
    const lead = REMIND[prefs.remind] ?? 10
    for (const e of events) {
      const start = Math.round(e.start * 60)
      if (start > mins && start - mins <= lead)
        once(`${day}|up|${e.id}`, e.title, T(`Starts at ${clock(start)}`))
    }
    for (const t of todayTasks) {
      const p = parseTime(t.time)
      if (p && p.start > mins && p.start - mins <= lead)
        once(`${day}|upt|${t.id}`, t.title, T(`Planned for ${clock(p.start)}`))
    }
  }

  if (push(ROW.tasksDue) && todayTasks.length > 0 && mins >= 960 && mins < 1020) {
    once(
      `${day}|due`,
      'Still open today',
      `${todayTasks.length} ${todayTasks.length === 1 ? 'task is' : 'tasks are'} still open.`
    )
  }

  if (push(ROW.habits)) {
    for (const h of useHabits.getState().habits) {
      const t = toMin(h.time)
      if (!h.doneToday && mins >= t && mins < t + 10) once(`${day}|habit|${h.id}`, h.name, `Time for your habit (${h.length}).`)
    }
  }

  if (push(ROW.weekly) && weekdayIndex(now) === 4 && mins >= 1020 && mins < 1080) {
    once(`${day}|weekly`, 'Weekly review', 'Take a few minutes to look back on your week.')
  }
}

/** Starts the 30-second check. Returns a function that stops it. */
export function startNotifier(): () => void {
  let stopped = false
  let timer: ReturnType<typeof setInterval> | null = null
  void loadFired(dayKey(appToday())).then(() => {
    if (stopped) return
    checkNotifications()
    timer = setInterval(() => checkNotifications(), 30000)
  })
  return () => {
    stopped = true
    if (timer) clearInterval(timer)
  }
}
