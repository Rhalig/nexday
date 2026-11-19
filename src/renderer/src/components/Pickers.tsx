import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Button, Kbd, cn, projectColor } from './ui'
import { projects, type Project, type Task } from '../data/tasks'
import {
  addDays,
  appToday,
  dayKey,
  daysFromToday,
  monthLong,
  monthShort,
  parseDayKey,
  startOfMonth,
  startOfWeek,
  weekdayShort
} from '../lib/clock'
import './dialogs.css'

function useEsc(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
}

function Catcher({ onClose }: { onClose: () => void }): React.JSX.Element {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 44 }} onMouseDown={onClose} />
}

/* ---------------- Tasks filter & sort ---------------- */

export type TaskView = {
  sort: 'Date' | 'Project' | 'Energy' | 'Length'
  group: 'Day' | 'Project' | 'None'
  projects: Record<Project, boolean>
  energy: { 'Deep focus': boolean; Light: boolean }
  status: { 'Has a time': boolean; 'No time yet': boolean }
}

export const defaultView: TaskView = {
  sort: 'Date',
  group: 'Day',
  projects: { planner: true, moving: true, reading: true, personal: true },
  energy: { 'Deep focus': false, Light: false },
  status: { 'Has a time': false, 'No time yet': false }
}

export const isDefaultView = (v: TaskView): boolean =>
  JSON.stringify(v) === JSON.stringify(defaultView)

export function passesFilter(t: Task, v: TaskView): boolean {
  if (!v.projects[t.project]) return false
  const energyOn = Object.entries(v.energy)
    .filter(([, on]) => on)
    .map(([k]) => k)
  if (energyOn.length && !energyOn.includes(t.energy)) return false
  const statusOn = Object.entries(v.status)
    .filter(([, on]) => on)
    .map(([k]) => k)
  if (statusOn.length) {
    const label = t.time === null ? 'No time yet' : 'Has a time'
    if (!statusOn.includes(label)) return false
  }
  return true
}

const check = <Icon name="check" size={10} strokeWidth={3.2} />

export function FilterPopover({
  anchor,
  view,
  setView,
  tasks,
  onClose
}: {
  anchor: { right: number; top: number }
  view: TaskView
  setView: (v: TaskView) => void
  tasks: Task[]
  onClose: () => void
}): React.JSX.Element {
  useEsc(onClose)
  const count = (fn: (t: Task) => boolean): number => tasks.filter(fn).length

  return (
    <>
      <Catcher onClose={onClose} />
      <div
        className="pv"
        style={{
          left: anchor.right - 360,
          top: anchor.top,
          width: 360,
          borderRadius: 16,
          padding: '6px 20px 16px'
        }}
      >
        <div className="pv-sec">
          <div className="pv-lb">Sort by</div>
          <div className="pv-seg">
            {(['Date', 'Project', 'Energy', 'Length'] as const).map((s) => (
              <button
                key={s}
                className={cn(view.sort === s && 'on')}
                onClick={() => setView({ ...view, sort: s })}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="pv-sec">
          <div className="pv-lb">Group by</div>
          <div className="pv-seg">
            {(['Day', 'Project', 'None'] as const).map((g) => (
              <button
                key={g}
                className={cn(view.group === g && 'on')}
                onClick={() => setView({ ...view, group: g })}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="pv-sec">
          <div className="pv-lb">Project</div>
          {(Object.keys(projects) as Project[]).map((p) => (
            <button
              key={p}
              className="pv-opt"
              onClick={() =>
                setView({ ...view, projects: { ...view.projects, [p]: !view.projects[p] } })
              }
            >
              <span className={cn('pv-ck', view.projects[p] && 'on')}>
                {view.projects[p] && check}
              </span>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: projectColor[p] }} />
              {projects[p].name}
              <span className="m">{count((t) => t.project === p)}</span>
            </button>
          ))}
        </div>
        <div className="pv-sec">
          <div className="pv-lb">Energy</div>
          {(['Deep focus', 'Light'] as const).map((e) => (
            <button
              key={e}
              className="pv-opt"
              onClick={() => setView({ ...view, energy: { ...view.energy, [e]: !view.energy[e] } })}
            >
              <span className={cn('pv-ck', view.energy[e] && 'on')}>{view.energy[e] && check}</span>
              {e}
              <span className="m">{count((t) => t.energy === e)}</span>
            </button>
          ))}
        </div>
        <div className="pv-sec" style={{ borderBottom: 0 }}>
          <div className="pv-lb">Status</div>
          {(['Has a time', 'No time yet'] as const).map((s) => (
            <button
              key={s}
              className="pv-opt"
              onClick={() => setView({ ...view, status: { ...view.status, [s]: !view.status[s] } })}
            >
              <span className={cn('pv-ck', view.status[s] && 'on')}>{view.status[s] && check}</span>
              {s}
              <span className="m">
                {count((t) => (s === 'No time yet' ? t.time === null : t.time !== null))}
              </span>
            </button>
          ))}
        </div>
        <div
          className="row"
          style={{
            justifyContent: 'space-between',
            paddingTop: 12,
            borderTop: '1px solid #EDEDEB'
          }}
        >
          <button
            style={{ padding: 0, fontSize: 13, color: '#6B6B6B' }}
            onClick={() => setView(defaultView)}
          >
            Reset
          </button>
          <div className="row" style={{ gap: 10 }}>
            <Kbd>esc</Kbd>
            <button
              className="row"
              onClick={onClose}
              style={{
                height: 34,
                padding: '0 16px',
                borderRadius: 10,
                background: '#1A1A1A',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------------- Snooze picker ---------------- */

const snoozeOptions = [
  { label: 'Later today', sub: 'Next open gap', time: '18:00' },
  { label: 'Tomorrow', sub: 'Wednesday', time: '09:00' },
  { label: 'Monday', sub: 'Start of your week', time: '09:00' },
  { label: 'Next week', sub: 'Nov 23', time: '09:00' }
]

export function SnoozePopover({
  anchor,
  onPick,
  onClose
}: {
  anchor: { left: number; top: number }
  onPick: (label: string) => void
  onClose: () => void
}): React.JSX.Element {
  useEsc(onClose)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const n = Number(e.key)
      if (n >= 1 && n <= snoozeOptions.length) onPick(snoozeOptions[n - 1].label)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPick])

  return (
    <>
      <Catcher onClose={onClose} />
      <div
        className="pv from-left"
        style={{
          left: anchor.left,
          top: anchor.top,
          width: 320,
          borderRadius: 14,
          padding: '12px 16px 10px'
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', padding: '2px 0 8px' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Snooze until</span>
          <span style={{ fontSize: 12, color: '#767676' }}>It returns to Inbox</span>
        </div>
        {snoozeOptions.map((o, i) => (
          <button
            className="sn-o"
            key={o.label}
            style={i === 0 ? { borderTop: '1px solid #EDEDEB' } : undefined}
            onClick={() => onPick(o.label)}
          >
            <span className="t">
              <b>{o.label}</b>
              <i>{o.sub}</i>
            </span>
            <span className="m">{o.time}</span>
            <span className="sn-k">{i + 1}</span>
          </button>
        ))}
        <button
          className="sn-o"
          style={{ borderBottom: 0 }}
          onClick={() => onPick('a chosen date')}
        >
          <span className="t">
            <b>Pick date &amp; time</b>
          </span>
          <span style={{ color: '#767676', display: 'flex' }}>
            <Icon name="caretRight" size={14} strokeWidth={2} />
          </span>
        </button>
      </div>
    </>
  )
}

/* ---------------- Date & time picker (inside the New popup) ---------------- */

/** `day` is a YYYY-MM-DD key, or null for "no date". */
export type When = { day: string | null; start: string; end: string }

const slots: Array<{ start: string; end: string; note: string }> = [
  { start: '13:30', end: '13:45', note: 'Best fit' },
  { start: '16:30', end: '16:45', note: 'After critique' },
  { start: '18:00', end: '18:15', note: 'High energy' }
]

const mins = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatWhen(w: When): string {
  if (w.day === null) return 'No date'
  const d = parseDayKey(w.day)
  const diff = daysFromToday(d)
  const label =
    diff === 0
      ? 'Today'
      : diff === 1
        ? 'Tomorrow'
        : `${weekdayShort(d)}, ${monthShort(d)} ${d.getDate()}`
  return `${label}, ${w.start} – ${w.end}`
}

export function DatePicker({
  value,
  onChange,
  onClose
}: {
  value: When
  onChange: (w: When) => void
  onClose: () => void
}): React.JSX.Element {
  useEsc(onClose)
  const len = Math.max(mins(value.end) - mins(value.start), 0)
  const lenText =
    len >= 60 ? `${Math.floor(len / 60)} h${len % 60 ? ` ${len % 60} min` : ''}` : `${len} min`
  const today = appToday()
  const [month, setMonth] = useState(() => startOfMonth(value.day ? parseDayKey(value.day) : today))
  const monday = startOfWeek(today)
  const quick: Array<{ label: string; day: string | null }> = [
    { label: 'Today', day: dayKey(today) },
    { label: 'Tomorrow', day: dayKey(addDays(today, 1)) },
    { label: 'Next week', day: dayKey(addDays(monday, 7)) },
    { label: 'No date', day: null }
  ]
  // Six Monday-first weeks for the month on screen
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const gridStart = addDays(first, -lead)
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i)
    return { n: d.getDate(), key: dayKey(d), muted: d.getMonth() !== month.getMonth() }
  })
  const shiftMonth = (n: number): void =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <div className="dp" onMouseDown={(e) => e.stopPropagation()}>
      <div className="row" style={{ gap: 4 }}>
        {quick.map((q) => (
          <button
            key={q.label}
            className={cn('dp-q', value.day === q.day && 'on')}
            onClick={() => onChange({ ...value, day: q.day })}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="row" style={{ alignItems: 'flex-start', gap: 28, paddingTop: 10 }}>
        <div className="col" style={{ width: 290, flex: 'none' }}>
          <div className="row" style={{ justifyContent: 'space-between', padding: '0 4px 4px' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {monthLong(month)} {month.getFullYear()}
            </span>
            <div className="row" style={{ gap: 2 }}>
              <button
                aria-label="Previous month"
                className="row"
                style={{
                  width: 26,
                  height: 26,
                  justifyContent: 'center',
                  borderRadius: 8,
                  color: 'var(--ink2)'
                }}
                onClick={() => shiftMonth(-1)}
              >
                <Icon name="chevronLeft" size={15} strokeWidth={2} />
              </button>
              <button
                aria-label="Next month"
                className="row"
                style={{
                  width: 26,
                  height: 26,
                  justifyContent: 'center',
                  borderRadius: 8,
                  color: 'var(--ink2)'
                }}
                onClick={() => shiftMonth(1)}
              >
                <Icon name="chevronRight" size={15} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="dp-g">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span className="dp-wd" key={i}>
                {d}
              </span>
            ))}
          </div>
          <div className="dp-g">
            {cells.map((c) => (
              <span
                key={c.key}
                className={cn('dp-d', c.muted && 'm', value.day === c.key && 's')}
                onClick={() => {
                  if (c.muted) setMonth(startOfMonth(parseDayKey(c.key)))
                  onChange({ ...value, day: c.key })
                }}
              >
                {c.n}
              </span>
            ))}
          </div>
        </div>
        <div className="col" style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          <div
            className="row"
            style={{ gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}
          >
            <div className="col" style={{ flex: 1 }}>
              <span className="muted" style={{ fontSize: 11.5 }}>
                Start
              </span>
              <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>
                {value.start}
              </span>
            </div>
            <span style={{ color: '#767676', display: 'flex' }}>
              <Icon name="arrowRight" size={16} strokeWidth={2} />
            </span>
            <div className="col" style={{ flex: 1 }}>
              <span className="muted" style={{ fontSize: 11.5 }}>
                End
              </span>
              <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>
                {value.end}
              </span>
            </div>
            <span className="mono muted" style={{ fontSize: 12.5 }}>
              {lenText}
            </span>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <span style={{ color: '#E2680C', display: 'flex' }}>
              <Icon name="bolt" size={13} strokeWidth={2} />
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              Free slots today
            </span>
          </div>
          <div className="col" style={{ marginTop: 2 }}>
            {slots.map((s, i) => {
              const on = value.start === s.start && value.end === s.end
              return (
                <button
                  className="dp-sl"
                  key={s.start}
                  style={i === slots.length - 1 ? { borderBottom: 0 } : undefined}
                  onClick={() =>
                    onChange({
                      ...value,
                      day: value.day ?? dayKey(today),
                      start: s.start,
                      end: s.end
                    })
                  }
                >
                  <span
                    className="mono"
                    style={{ flex: 1, fontSize: 13.5, fontWeight: on ? 500 : 400 }}
                  >
                    {s.start} – {s.end}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: i === 0 ? 500 : 400,
                      color: i === 0 ? 'var(--acc-text)' : 'var(--ink2)'
                    }}
                  >
                    {s.note}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          marginTop: 8,
          paddingTop: 10,
          borderTop: '1px solid var(--line)'
        }}
      >
        <button
          className="row"
          style={{ height: 36, padding: '0 6px' }}
          onClick={() => onChange({ day: null, start: '13:30', end: '13:45' })}
        >
          <span className="muted" style={{ fontSize: 13 }}>
            Clear
          </span>
        </button>
        <div className="row" style={{ gap: 8 }}>
          <Kbd>esc</Kbd>
          <Button variant="dark" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
