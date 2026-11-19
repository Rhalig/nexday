import { useUI } from '../../store/ui'
import { useRef, useState } from 'react'
import { useTasks } from '../../store/tasks'
import { parseCapture, toTask } from '../../lib/capture'
import { Icon } from '../../components/Icon'
import { projectColor } from '../../components/ui'
import { projects, type Project } from '../../data/tasks'
import { T } from '../../lib/prefs'
import { CardDrop, TimelineDrop, dragProps } from '../../components/dnd'
import { DAY_END, DAY_START, clock, fmtMin, type PlanGroup, type PlanTask, type TodayData } from '../../lib/today'

const hints: Record<string, string> = {}

const Meta = ({ project, right, hot, mono }: { project: Project; right: string; hot?: boolean; mono?: boolean }): React.JSX.Element => (
  <div className="m">
    <div className="swatch" style={{ background: projectColor[project], width: 10, height: 10, borderRadius: 3 }} />
    {projects[project].name}
    <span className={mono ? 'r mono' : 'r'} style={hot ? { color: 'var(--acc-text)', fontWeight: 500 } : undefined}>
      {T(right)}
    </span>
  </div>
)

const BOARD_COLUMNS: Array<{ id: string; title: string; start: string }> = [
  { id: 'morning', title: 'Morning', start: '09:00' },
  { id: 'afternoon', title: 'Afternoon', start: '14:00' },
  { id: 'evening', title: 'Evening', start: '18:00' }
]

/**
 * Columns by part of the day. Dropping a card on another column moves the task to that part of the
 * day (09:00 / 14:00 / 18:00, keeping its length); dropping it on Done completes it.
 */
export function TodayBoard({
  plan,
  onOpen,
  onMove,
  onDone
}: {
  plan: PlanGroup[]
  onOpen: (id: string) => void
  onMove: (id: string, start: string, len: number) => void
  onDone: (id: string) => void
}): React.JSX.Element {
  // The column whose "Add task" row is open, and what has been typed in it
  const [adding, setAdding] = useState<string | null>(null)
  const [text, setText] = useState('')
  const adder = useRef(false)
  const addTo = (start: string): void => {
    if (!adder.current) return // Enter and the blur it causes must not add twice
    adder.current = false
    const value = text.trim()
    setAdding(null)
    setText('')
    if (!value) return
    // A time in the words wins; otherwise the task takes the column's start (no time for Anytime).
    const p = parseCapture(value)
    const made = toTask({ ...p, group: 'today', time: p.time ?? (start || '09:00') })
    useTasks.getState().add(start || p.time ? made.task : { ...made.task, time: null }, 'today')
  }
  const done: PlanTask[] = plan.flatMap((g) => g.tasks.filter((t) => t.done))
  const groupOf = (id: string): string | undefined => plan.find((g) => g.tasks.some((t) => t.id === id))?.id
  const anytime = plan.find((g) => g.id === 'anytime')
  const columns = [
    ...BOARD_COLUMNS.map((c) => ({ ...c, group: plan.find((g) => g.id === c.id) })),
    ...(anytime ? [{ id: 'anytime', title: 'Anytime', start: '', group: anytime }] : [])
  ]
  return (
    <div className="tv-board">
      {columns.map((c) => {
        const g = c.group
        const open = g?.tasks.filter((t) => !t.done) ?? []
        return (
          <CardDrop
            className="tv-col"
            key={c.id}
            accepts={(d) => d.kind === 'task' && !!c.start && groupOf(d.id) !== c.id}
            onDropCard={(d) => {
              const t = plan.flatMap((x) => x.tasks).find((x) => x.id === d.id)
              if (t && !t.done) onMove(d.id, c.start, t.len ?? 30)
            }}
          >
            <div className="tv-colh">
              <span>{c.title}</span>
              <span className="n">{open.length}</span>
              {(g?.link ?? hints[c.id]) && <span className="hint">{T(g?.link ?? hints[c.id])}</span>}
            </div>
            {open.map((t) => (
              <div
                className="tv-card"
                key={t.id}
                onClick={() => onOpen(t.id)}
                {...dragProps({ kind: 'task', id: t.id, title: t.title, minutes: t.len ?? 30 })}
              >
                <span className="t">{t.title}</span>
                <Meta project={t.project} right={t.time} hot={t.hot} mono />
              </div>
            ))}
            {adding === c.id ? (
              <div className="tv-add on">
                <Icon name="plus" size={14} strokeWidth={2} />
                <input
                  autoFocus
                  value={text}
                  placeholder={`Add to ${c.title.toLowerCase()}…`}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTo(c.start)
                    else if (e.key === 'Escape') {
                      e.stopPropagation()
                      adder.current = false
                      setAdding(null)
                      setText('')
                    }
                  }}
                  onBlur={() => addTo(c.start)}
                />
              </div>
            ) : (
              <button
                className="tv-add"
                onClick={() => {
                  adder.current = true
                  setAdding(c.id)
                  setText('')
                }}
              >
                <Icon name="plus" size={14} strokeWidth={2} />
                Add task
              </button>
            )}
          </CardDrop>
        )
      })}
      <CardDrop
        className="tv-col"
        accepts={(d) => d.kind === 'task'}
        onDropCard={(d) => onDone(d.id)}
      >
        <div className="tv-colh">
          <span>Done</span>
          <span className="n">{done.length}</span>
        </div>
        {done.map((t) => (
          <div className="tv-card done" key={t.id}>
            <span className="t">{t.title}</span>
            <Meta project={t.project} right={t.doneAt ?? ''} />
          </div>
        ))}
      </CardDrop>
    </div>
  )
}

const hoursLabels = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => `${String(DAY_START / 60 + i).padStart(2, '0')}:00`)
const PX = 44 / 60
const yOf = (min: number): number => (min - DAY_START) * PX + 2
// The afternoon stretch where the energy curve picks up again (same curve as the Day strip)
const ENERGY_PEAK = { start: 16 * 60 + 30, end: 18 * 60 }
const evClass = { health: 'h', work: 'w', personal: 'p', moved: 'mv', free: '' } as const

export function TodayCalendar({
  data,
  nowMin,
  onPlace,
  defaultLen
}: {
  data: TodayData
  nowMin: number
  /** A task was dropped on the timeline: its id, start minute and length */
  onPlace: (id: string, startMin: number, len: number) => void
  defaultLen: number
}): React.JSX.Element {
  const groups = useTasks((s) => s.groups)
  const projectOf = (id: string): string => {
    for (const g of groups) for (const t of g.tasks) if (t.id === id) return t.project
    return 'planner'
  }
  const blocks = data.strip.filter((s) => s.kind !== 'free' && s.end > DAY_START && s.start < DAY_END)
  return (
    <div className="tv-cal">
      <div className="tv-time">
        <div className="col" style={{ width: 48, flex: 'none' }}>
          {hoursLabels.map((h) => (
            <div className="tv-hl" key={h}>
              {T(h)}
            </div>
          ))}
        </div>
        <TimelineDrop
          className="tv-grid"
          pxPerHour={44}
          startHour={DAY_START / 60}
          endHour={DAY_END / 60}
          topOffset={2}
          accepts={(d) => d.kind === 'task'}
          onDropAt={(d, min) => onPlace(d.id, min, d.minutes)}
        >
          {blocks
            .filter((b) => !b.key.startsWith('t-'))
            .map((e) => (
              <div
                className={`tv-ev ${evClass[e.kind]}`}
                key={e.key}
                style={{ top: yOf(Math.max(e.start, DAY_START)), height: Math.max(22, (e.end - e.start) * PX - 4) }}
              >
                <b>{e.title}</b>
                <i>{T(e.hint)}</i>
              </div>
            ))}
          {data.eventGaps.map((g) => (
            <div
              className="tv-ev"
              key={`g${g.start}`}
              style={{ top: yOf(g.start), height: (g.end - g.start) * PX - 4, border: '1px dashed #CBCBC8', color: 'var(--ink3)', flexDirection: 'row', gap: 12, padding: '10px 14px', alignItems: 'flex-start', pointerEvents: 'none' }}
            >
              <span style={{ fontSize: 12, fontWeight: 500 }}>Free · {fmtMin(g.end - g.start)}</span>
              <button
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--acc-text)', pointerEvents: 'auto' }}
                onClick={() => useUI.getState().openDialog('autoSchedule')}
              >
                Fill the gap
              </button>
            </div>
          ))}
          {blocks
            .filter((b) => b.key.startsWith('t-'))
            .map((t) => (
              <div
                className="tv-ev chip"
                key={t.key}
                style={{ top: yOf(Math.max(t.start, DAY_START)) - 2, borderLeftColor: projectColor[projectOf(t.key.slice(2))] }}
                {...dragProps({ kind: 'task', id: t.key.slice(2), title: t.title, minutes: t.end - t.start })}
              >
                <b>
                  {t.title} · {T(clock(t.start))}
                </b>
              </div>
            ))}
          <div
            aria-hidden
            style={{ position: 'absolute', right: 0, top: yOf(ENERGY_PEAK.start), width: 3, height: (ENERGY_PEAK.end - ENERGY_PEAK.start) * PX, borderRadius: 2, background: 'var(--acc)', opacity: 0.35, pointerEvents: 'none' }}
          />
          {nowMin >= DAY_START && nowMin <= DAY_END && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: yOf(nowMin), height: 2, background: 'var(--acc)', borderRadius: 1 }}>
              <span style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--acc)' }} />
              <span style={{ position: 'absolute', right: 0, top: -18, fontSize: 11, color: 'var(--acc-text)', fontWeight: 500 }}>{T(clock(nowMin))}</span>
            </div>
          )}
        </TimelineDrop>
      </div>
      <div className="col" style={{ width: 300, flex: 'none' }}>
        <div className="row" style={{ paddingBottom: 8, borderBottom: '1px solid var(--line2)' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Unscheduled</span>
          <span className="muted" style={{ fontSize: 12.5, marginLeft: 8 }}>
            {data.unscheduled.length}
          </span>
        </div>
        {data.unscheduled.length === 0 ? (
          <div className="tv-ur">
            <span className="muted" style={{ fontSize: 13 }}>
              Every task for today is on the timeline.
            </span>
          </div>
        ) : (
          data.unscheduled.map((t) => (
            <div
              className="tv-ur"
              key={t.id}
              style={{ cursor: 'grab' }}
              {...dragProps({ kind: 'task', id: t.id, title: t.title, minutes: t.len ?? defaultLen })}
            >
              <span className="tv-cbx" />
              <span style={{ fontSize: 13 }}>{t.title}</span>
              <span className="tv-r">{fmtMin(t.len ?? defaultLen)}</span>
            </div>
          ))
        )}
        <div className="row" style={{ gap: 10, alignItems: 'flex-start', paddingTop: 16 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc-strong)" strokeWidth="2" style={{ marginTop: 2 }}>
            <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
          </svg>
          <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            Drag a task on the timeline to move it. Your energy picks up {T(clock(ENERGY_PEAK.start))} – {T(clock(ENERGY_PEAK.end))}.
          </span>
        </div>
      </div>
    </div>
  )
}
