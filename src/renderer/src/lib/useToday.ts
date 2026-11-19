import { useEffect, useMemo, useState } from 'react'
import { useCalendar } from '../store/calendar'
import { useTasks } from '../store/tasks'
import { appToday, dayKey, startOfWeek } from './clock'
import { buildToday, type TodayData } from './today'

/** Today's numbers from the live stores. Also makes sure the calendar store covers today. */
export function useTodayData(): { data: TodayData; now: Date } {
  // A minute clock, so "Up next" and the free gaps move on their own.
  const [now, setNow] = useState(() => appToday())
  useEffect(() => {
    const id = setInterval(() => setNow(appToday()), 60000)
    return () => clearInterval(id)
  }, [])

  const today = dayKey(now)
  const range = useCalendar((s) => s.range)
  useEffect(() => {
    if (!range || today < range.from || today > range.to)
      void useCalendar.getState().loadWeek(startOfWeek(appToday()))
  }, [today, range])

  const calEvents = useCalendar((s) => s.events)
  const macOn = useCalendar((s) => s.status === 'authorized')
  const groups = useTasks((s) => s.groups)
  const done = useTasks((s) => s.doneToday)

  const data = useMemo(
    () =>
      buildToday({
        // Until Mac Calendar is connected the store holds design sample events: leave those out.
        events: calEvents.filter((e) => e.date === today && (macOn || e.sourceId)),
        groups,
        done,
        now
      }),
    [calEvents, today, macOn, groups, done, now]
  )
  return { data, now }
}
