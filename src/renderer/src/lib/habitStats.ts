import type { Habit } from '../data/habits'
import { addDays, dayKey, startOfWeek } from './clock'

/** Habit numbers worked out from real check-ins (history = last 12 weeks, today excluded). */

export type History = Record<string, string[]>

const doneOn = (h: Habit, history: History, key: string, todayKey: string): boolean =>
  key === todayKey ? h.doneToday : !!history[h.id]?.includes(key)

/** Streak, 30-day rate and check-in count for one habit. */
export function habitNumbers(
  h: Habit,
  history: History,
  now: Date
): { streak: number; rate: number; checkIns: number } {
  const todayKey = dayKey(now)
  // Today only counts once it is done, so an open today does not break a running streak.
  let streak = 0
  for (let i = h.doneToday ? 0 : 1; i < 84; i++) {
    if (!doneOn(h, history, dayKey(addDays(now, -i)), todayKey)) break
    streak++
  }
  let last30 = 0
  for (let i = 0; i < 30; i++) if (doneOn(h, history, dayKey(addDays(now, -i)), todayKey)) last30++
  const checkIns = (history[h.id]?.length ?? 0) + (h.doneToday ? 1 : 0)
  return { streak, rate: Math.round((last30 / 30) * 100), checkIns }
}

export type HabitStats = {
  activeStreak: number
  weekRate: number | null
  monthRate: number | null
  /** 12 columns (Mon-first weeks, oldest first) of 7 levels 0–3 */
  heatmap: number[][]
  /** Short month name over the first column of each month, '' elsewhere */
  months: string[]
  checkIns: number
  longest: { days: number; name: string } | null
  strongest: string | null
  weakest: string | null
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function habitStats(habits: Habit[], history: History, now: Date): HabitStats {
  const todayKey = dayKey(now)
  const n = habits.length
  const doneCount = (key: string): number => habits.filter((h) => doneOn(h, history, key, todayKey)).length
  const start = addDays(startOfWeek(now), -77)

  const heatmap: number[][] = []
  const months: string[] = []
  const perWeekday = Array.from({ length: 7 }, () => ({ done: 0, days: 0 }))
  let total = 0
  for (let w = 0; w < 12; w++) {
    const col: number[] = []
    const monday = addDays(start, w * 7)
    const prev = addDays(monday, -7)
    months.push(w === 0 || monday.getMonth() !== prev.getMonth() ? MONTHS[monday.getMonth()] : '')
    for (let d = 0; d < 7; d++) {
      const day = addDays(monday, d)
      const key = dayKey(day)
      if (key > todayKey || n === 0) {
        col.push(0)
        continue
      }
      const done = doneCount(key)
      total += done
      perWeekday[d].done += done
      perWeekday[d].days++
      const f = done / n
      col.push(done === 0 ? 0 : f < 0.5 ? 1 : f < 1 ? 2 : 3)
    }
    heatmap.push(col)
  }

  // A month that only owns the first column would crowd the next label: skip it.
  if (months[0] && months[1]) months[0] = ''

  const rateSince = (from: Date): number | null => {
    if (n === 0) return null
    let done = 0
    let days = 0
    for (let d = from; dayKey(d) <= todayKey; d = addDays(d, 1)) {
      done += doneCount(dayKey(d))
      days++
    }
    return days ? Math.round((done / (days * n)) * 100) : null
  }

  const nums = habits.map((h) => ({ h, ...habitNumbers(h, history, now) }))
  const best = nums.reduce<(typeof nums)[number] | null>((a, x) => (!a || x.streak > a.streak ? x : a), null)
  const enough = total >= 7
  const rates = perWeekday.map((x, i) => ({ i, r: x.days && n ? x.done / (x.days * n) : 0 }))
  const sorted = [...rates].sort((a, b) => b.r - a.r)
  return {
    activeStreak: best?.streak ?? 0,
    weekRate: rateSince(startOfWeek(now)),
    monthRate: rateSince(new Date(now.getFullYear(), now.getMonth(), 1)),
    heatmap,
    months,
    checkIns: total,
    longest: best && best.streak > 0 ? { days: best.streak, name: best.h.name } : null,
    strongest: enough ? WEEKDAYS[sorted[0].i] : null,
    weakest: enough ? WEEKDAYS[sorted[sorted.length - 1].i] : null
  }
}

/** The habit with the longest streak and how many of the last 14 days it was done. */
export function milestone(
  habits: Habit[],
  history: History,
  now: Date
): { name: string; days: number; streak: number } | null {
  const todayKey = dayKey(now)
  let best: { name: string; days: number; streak: number } | null = null
  for (const h of habits) {
    const { streak } = habitNumbers(h, history, now)
    let days = 0
    for (let i = 0; i < 14; i++) if (doneOn(h, history, dayKey(addDays(now, -i)), todayKey)) days++
    if (!best || streak > best.streak) best = { name: h.name, days, streak }
  }
  return best
}
