import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Suggestion } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { Button, Segmented, cn } from '../../components/ui'
import {
  GRID_START,
  dotColor,
  eventClass,
  monthWeeks,
  weekDays,
  type KindedEvent
} from '../../data/calendar'
import CalendarEmpty from './CalendarEmpty'
import EventDrawer from './EventDrawer'
import { useCalendar } from '../../store/calendar'
import { useAuth } from '../../store/auth'
import {
  addDays,
  appToday,
  dayKey,
  monthLong,
  monthShort,
  parseDayKey,
  sameDay,
  startOfWeek,
  weekdayLong
} from '../../lib/clock'
import { parseCapture } from '../../lib/capture'
import { T } from '../../lib/prefs'
import { TimelineDrop, dragProps, type Dragged } from '../../components/dnd'
import './calendar.css'

type View = 'week' | 'month'

const views: Array<{ id: View; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' }
]

const viewName: Record<View, string> = { week: 'Week view', month: 'Month view' }

const weekLabel = (start: Date): string => {
  const end = addDays(start, 6)
  const tail = end.getMonth() === start.getMonth() ? '' : `${monthShort(end)} `
  return `${monthShort(start)} ${start.getDate()} – ${tail}${end.getDate()}, ${end.getFullYear()}`
}

function Toolbar({
  view,
  onView,
  title,
  onPrev,
  onNext,
  onToday
}: {
  view: View
  onView: (v: View) => void
  title: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}): React.JSX.Element {
  return (
    <div className="cal-toolbar" style={{ paddingTop: view === 'week' ? 20 : 18 }}>
      <div className="cal-nav">
        <Button aria-label="Previous" onClick={onPrev}>
          <Icon name="chevronLeft" size={13} strokeWidth={2} />
        </Button>
        <span className="cal-title">{title}</span>
        <Button aria-label="Next" onClick={onNext}>
          <Icon name="chevronRight" size={13} strokeWidth={2} />
        </Button>
        <Button className="today" onClick={onToday}>
          Today
        </Button>
      </div>
      <Segmented items={views} value={view} onChange={onView} />
    </div>
  )
}

/* ---------------- helpers ---------------- */

const nowDecimal = (): number => {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

type Gap = { start: number; end: number }

/** Gaps between events inside working hours, at least half an hour long. */
function freeGaps(events: KindedEvent[], from = 8, to = 20): Gap[] {
  const busy = events
    .map((e) => [Math.max(e.start, from), Math.min(e.end, to)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])
  const gaps: Gap[] = []
  let cursor = from
  for (const [s, e] of busy) {
    if (s - cursor >= 0.5) gaps.push({ start: cursor, end: s })
    cursor = Math.max(cursor, e)
  }
  if (to - cursor >= 0.5) gaps.push({ start: cursor, end: to })
  return gaps
}

/* ---------------- Week ---------------- */

/** Only events made in Nexday that are neither recurring nor all-day can be dragged. */
const canDrag = (e: KindedEvent): boolean => !!e.sourceId && !e.allDay && !e.id.includes('@')
const eventDrag = (e: KindedEvent): Omit<Dragged, 'offsetY'> => ({
  kind: 'event',
  id: e.id,
  title: e.title,
  minutes: Math.round((e.end - e.start) * 60)
})

/** The hours a grid shows: the usual window, widened to take in any event that falls outside it. */
function gridSpan(events: KindedEvent[], usualEnd: number): { start: number; end: number } {
  const timed = events.filter((e) => !e.allDay)
  const start = timed.length ? Math.min(GRID_START, Math.floor(Math.min(...timed.map((e) => e.start)))) : GRID_START
  const end = timed.length ? Math.min(24, Math.max(usualEnd, Math.ceil(Math.max(...timed.map((e) => e.end))))) : usualEnd
  return { start: Math.max(0, start), end }
}

function WeekView({ onOpen }: { onOpen: (id: string) => void }): React.JSX.Element {
  const events = useCalendar((st) => st.events)
  const weekStart = useCalendar((st) => st.weekStart)
  const days = weekDays(weekStart)
  const span = gridSpan(
    events.filter((e) => days.some((d) => d.date === e.date)),
    GRID_START + 12
  )
  const gs = span.start
  const hours = Array.from({ length: span.end - gs }, (_, i) => String((gs + 1 + i) % 24).padStart(2, '0'))
  const px = 52
  return (
    <div className="wgrid">
      <div className="wg-head">
        <div className="wg-corner" />
        {days.map((d, i) => (
          <div className={cn('wg-dh', i >= 5 && 'weekend', d.today && 'today')} key={d.date}>
            <div className="wg-num">{d.n}</div>
            <span className="wg-wd">{d.label}</span>
          </div>
        ))}
      </div>
      {events.some((e) => e.allDay) && (
        <div className="wg-allday">
          <div className="wg-corner" />
          {days.map((d) => (
            <div className="wg-ad" key={d.date}>
              {events
                .filter((e) => e.allDay && e.date === d.date)
                .map((e) => (
                  <div
                    className="wg-ad-chip"
                    key={e.id}
                    onClick={() => onOpen(e.id)}
                    style={{ boxShadow: `inset 3px 0 0 ${dotColor[e.kind]}` }}
                  >
                    {e.title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="wg-body">
        <div className="wg-hours">
          {hours.map((h) => (
            <div className="wg-hour" key={h}>
              <span>{T(`${h}:00`).replace(':00', '')}</span>
            </div>
          ))}
        </div>
        {days.map((d, i) => (
          <TimelineDrop
            className={cn('wg-col', i >= 5 && 'weekend')}
            key={d.date}
            pxPerHour={px}
            startHour={gs}
            accepts={(x) => x.kind === 'event'}
            onDropAt={(x, min) => useCalendar.getState().move(x.id, d.date, min)}
          >
            {d.today && (
              <div
                className="now-line"
                style={{ top: Math.round((nowDecimal() - gs) * px) }}
              >
                <i />
              </div>
            )}
            {events
              .filter((e) => e.date === d.date && !e.allDay)
              .map((e) => (
                <WeekEvent key={e.id} e={e} px={px} gs={gs} onOpen={onOpen} />
              ))}
          </TimelineDrop>
        ))}
      </div>
    </div>
  )
}

function WeekEvent({
  e,
  px,
  gs,
  onOpen
}: {
  e: KindedEvent
  px: number
  gs: number
  onOpen: (id: string) => void
}): React.JSX.Element {
  return (
    <div
      onClick={() => onOpen(e.id)}
      className={cn('ev', eventClass[e.kind])}
      style={{ top: (e.start - gs) * px, height: (e.end - e.start) * px }}
      {...dragProps(eventDrag(e), canDrag(e))}
    >
      <span className="ev-t">{e.title}</span>
      {e.sub && <span className="ev-sub">{T(e.sub)}</span>}
    </div>
  )
}

const calendarSuggestions: Suggestion[] = [
  {
    typed: 'Lunch with Ece',
    ghost: ' tomorrow 13:00 #personal',
    title: 'Lunch with Ece',
    project: 'personal'
  },
  {
    typed: 'Dentist Friday',
    ghost: ' 10:00 for 45 minutes',
    title: 'Dentist',
    project: 'personal'
  },
  {
    typed: 'Design critique',
    ghost: ' Thursday 15:00 with Mert #planner',
    title: 'Design critique',
    project: 'planner'
  },
  {
    typed: 'Pack boxes',
    ghost: ' Saturday morning, 2 hours #moving',
    title: 'Pack boxes',
    project: 'moving'
  }
]

const WEEKDAY_INDEX: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6
}

/** Plain words → an event on the calendar. */
function createEventFromText(text: string): void {
  const p = parseCapture(text)
  const today = appToday()
  let date = today
  if (p.group === 'tomorrow') {
    date = addDays(today, 1)
  } else if (p.weekday) {
    date = addDays(startOfWeek(today), WEEKDAY_INDEX[p.weekday] ?? 0)
    if (dayKey(date) < dayKey(today)) date = addDays(date, 7)
  } else if (p.group === 'next-week') {
    date = addDays(startOfWeek(today), 7)
  }
  const start = p.time ?? '09:00'
  const [h, m] = start.split(':').map(Number)
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59)
  const end = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  useCalendar
    .getState()
    .add({ title: p.title || text, date: dayKey(date), start, end })
}

/** Same capture bar as Today, with calendar examples. */
function WeekCapture(): React.JSX.Element {
  return (
    <QuickCapture
      sticky
      placeholder={'Type anything… "dentist Friday 10am"'}
      button="Send"
      hint="Understands plain language: tomorrow → Wednesday, 15:00 → event, #personal → tag"
      suggestions={calendarSuggestions}
      onSubmit={createEventFromText}
    />
  )
}

/* ---------------- Month ---------------- */

function MonthView({
  month,
  events,
  onOpenDay
}: {
  month: Date
  events: KindedEvent[]
  onOpenDay: (date: string) => void
}): React.JSX.Element {
  const weeks = monthWeeks(month, events)
  return (
    <div className="mgrid">
      <div className="mg-head">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span className="mg-wd" key={d}>
            {d}
          </span>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div className="mg-wk" key={wi}>
          {week.map((c) => {
            const shown = c.events.slice(0, 2)
            const more = c.events.length - shown.length
            return (
              <div
                key={c.key}
                className={cn(
                  'mg-c',
                  c.other && 'other',
                  c.weekend && 'weekend',
                  c.today && 'today',
                  c.past && 'past'
                )}
                onClick={() => onOpenDay(c.date)}
              >
                <span className={cn('mg-n', c.today && 't')}>{c.n}</span>
                {shown.map((e, i) => (
                  <div className="mg-e" key={i}>
                    <i style={{ background: dotColor[e.kind] }} />
                    <b>{e.title}</b>
                    <s>{e.time}</s>
                  </div>
                ))}
                {more > 0 && <span className="mg-more">+{more} more</span>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ---------------- Page ---------------- */

function PageHeadFor({
  view,
  events,
  day,
  month
}: {
  view: View
  events: KindedEvent[]
  day: string
  month: Date
}): React.JSX.Element {
  const name = useAuth((s) => s.name)
  const dayDate = parseDayKey(day)
  const isToday = sameDay(dayDate, appToday())
  const dayEvents = events.filter((e) => e.date === day).sort((a, b) => a.start - b.start)
  const todayGaps = freeGaps(dayEvents)
  const weekCount = events.length
  const focus = events.filter((e) => e.kind === 'acc').reduce((n, e) => n + (e.end - e.start), 0)
  const daysWith = new Set(events.map((e) => e.date)).size
  const h = (n: number): string => `${Math.floor(n)}h${n % 1 >= 0.5 ? ' 30m' : ''}`

  if (view === 'month') {
    const monthEvents = events.filter((e) => {
      const d = parseDayKey(e.date)
      return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
    })
    return (
      <PageHead
        date="Month at a glance"
        title={`${monthLong(month)} ${month.getFullYear()}`}
        sub={`${monthEvents.length} saved events this month.`}
        stats={[
          ['Events', String(monthEvents.length)],
          ['Focus time', h(focus)],
          ['Days', String(daysWith)]
        ]}
      />
    )
  }
  return (
    <PageHead
      date={
        isToday
          ? `${weekdayLong(appToday())}, ${monthLong(appToday())} ${appToday().getDate()}`
          : 'This week'
      }
      title={`Your week at a glance${name ? `, ${name}` : ''}`}
      sub={`${weekCount} events this week.`}
      stats={[
        ['This week', `${weekCount} events`],
        ['Focus time', h(focus)],
        ['Free gaps', `${todayGaps.length} slots`]
      ]}
    />
  )
}

export default function Calendar(): React.JSX.Element {
  const events = useCalendar((st) => st.events)
  const weekStart = useCalendar((st) => st.weekStart)
  const day = useCalendar((st) => st.day)
  const month = useCalendar((st) => st.month)
  const navigate = useNavigate()
  const [view, setView] = useState<View>('week')
  const [connected, setConnected] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (view === 'week') void useCalendar.getState().loadWeek(useCalendar.getState().weekStart)
    else if (view === 'month') void useCalendar.getState().loadMonth(useCalendar.getState().month)
  }, [view])

  if (!connected) return <CalendarEmpty onConnect={() => setConnected(true)} />

  const weekStartDate = weekStart
  const title = view === 'week' ? weekLabel(weekStartDate) : `${monthLong(month)} ${month.getFullYear()}`

  const shift = (n: number): void => {
    if (view === 'week') void useCalendar.getState().loadWeek(addDays(weekStartDate, 7 * n))
    else void useCalendar.getState().loadMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  }
  const goToday = (): void => {
    const today = appToday()
    if (view === 'week') void useCalendar.getState().loadWeek(startOfWeek(today))
    else void useCalendar.getState().loadMonth(today)
  }

  const openEvent = events.find((e) => e.id === openId)
  const openOwn = openEvent?.sourceId
    ? useCalendar.getState().own.find((e) => e.id === openEvent.sourceId)
    : undefined
  const repeatLabel = !openOwn?.rrule
    ? 'Does not repeat'
    : openOwn.rrule.includes('BYDAY=MO,TU,WE,TH,FR')
      ? 'Every weekday'
      : openOwn.rrule.includes('FREQ=DAILY')
        ? 'Every day'
        : openOwn.rrule.includes('FREQ=MONTHLY')
          ? 'Every month'
          : 'Every week'
  return (
    <main className="panel cal">
      <Topbar icon="calendar" section="Calendar" current={viewName[view]} />
      <div className="panel-scroll">
        <PageHeadFor view={view} events={events} day={day} month={month} />
        <Toolbar
          view={view}
          onView={setView}
          title={title}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          onToday={goToday}
        />
        {view === 'week' && <WeekView onOpen={setOpenId} />}
        {view === 'month' && (
          <MonthView
            month={month}
            events={events}
            onOpenDay={(date) => navigate(`/tasks?day=${date}`)}
          />
        )}
        {view === 'week' && <WeekCapture />}
      </div>
      {openEvent && (
        <EventDrawer
          event={openEvent}
          onClose={() => setOpenId(null)}
          repeatLabel={repeatLabel}
          onDelete={
            openOwn
              ? () => {
                  useCalendar.getState().remove(openOwn.id)
                  setOpenId(null)
                }
              : undefined
          }
        />
      )}
    </main>
  )
}
