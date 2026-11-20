import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { TaskRow } from '../../components/TaskRow'
import { Segmented, Toggle, cn } from '../../components/ui'
import { TodayBoard } from './TodayViews'
import type { GhostTask } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { captureTask } from '../../lib/quickTask'
import { useTasks } from '../../store/tasks'
import { habitNumbers } from '../../lib/habitStats'
import { supabase } from '../../lib/supabase'
import { useTodayData } from '../../lib/useToday'
import { useHabits } from '../../store/habits'
import { useNotes } from '../../store/notes'
import { useUI } from '../../store/ui'
import {
  addDays,
  appToday,
  dayKey,
  pageDate,
  startOfWeek,
  weekdayIndex,
  weekdayLong
} from '../../lib/clock'
import {
  DAY_END,
  DAY_START,
  clock,
  fmtMin,
  inText,
  layoutLanes,
  type PlanGroup
} from '../../lib/today'
import { useNewIds } from '../../lib/useNewIds'
import './today.css'
import { greeting, useIdentity } from '../../lib/identity'
import { T } from '../../lib/prefs'

type View = 'list' | 'board'

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Puts a task on today at the given start, keeping its length. */
/** The list has three headings: Morning, Afternoon (evening tasks included) and Anytime. */
function listGroups(plan: PlanGroup[]): PlanGroup[] {
  const evening = plan.find((g) => g.id === 'evening')
  if (!evening) return plan
  const rest = plan.filter((g) => g.id !== 'evening')
  const afternoon = rest.find((g) => g.id === 'afternoon')
  if (afternoon) return rest.map((g) => (g === afternoon ? { ...g, tasks: [...g.tasks, ...evening.tasks] } : g))
  const at = rest.findIndex((g) => g.id === 'anytime')
  const made: PlanGroup = { id: 'afternoon', title: 'Afternoon', tasks: evening.tasks }
  return at < 0 ? [...rest, made] : [...rest.slice(0, at), made, ...rest.slice(at)]
}

function placeTask(id: string, startMin: number, len: number): void {
  const hhmm = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`
  useTasks.getState().move(id, 'today', `${hhmm} · ${fmtMin(len)}`)
}

export default function Today(): React.JSX.Element {
  const who = useIdentity()
  const navigate = useNavigate()
  const [energy, setEnergy] = useState(true)
  const [view, setView] = useState<View>('list')
  const [ghostTask, setGhostTask] = useState<GhostTask | null>(null)
  const openDialog = useUI((s) => s.openDialog)

  const { data: raw, now } = useTodayData()
  const showCompleted = useUI((s) => s.prefs.showCompleted)
  // "Show completed tasks" off: finished tasks leave the plan, the counts still include them.
  const data = showCompleted
    ? raw
    : {
        ...raw,
        plan: raw.plan
          .map((g) => ({ ...g, tasks: g.tasks.filter((t) => !t.done) }))
          .filter((g) => g.tasks.length > 0)
      }
  const fresh = useNewIds(data.plan.flatMap((g) => g.tasks.map((t) => t.id)))
  const storedHabits = useHabits((s) => s.habits)
  const history = useHabits((s) => s.history)
  const habits = storedHabits.filter((h) => !h.paused).map((h) => (supabase ? { ...h, ...habitNumbers(h, history, now) } : h))
  const notes = useNotes((s) => s.notes)

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextGap = data.gaps[0]
  const sub =
    data.eventCount + data.total === 0
      ? 'Nothing is planned for today yet.'
      : `${data.eventCount} ${data.eventCount === 1 ? 'event' : 'events'} and ${data.total} ${data.total === 1 ? 'task' : 'tasks'} today.${
          nextGap
            ? ` You have a ${fmtMin(nextGap.end - nextGap.start)} gap ${nextGap.start >= 12 * 60 ? 'this afternoon' : 'this morning'}.`
            : ''
        }`

  const monday = startOfWeek(now)
  const todayIdx = weekdayIndex(now)
  const cellsFor = (id: string, doneToday: boolean): Array<'y' | 't' | ''> =>
    Array.from({ length: 7 }, (_, i) => {
      if (i === todayIdx) return doneToday ? 'y' : 't'
      if (i > todayIdx) return ''
      return history[id]?.includes(dayKey(addDays(monday, i))) ? 'y' : ''
    })
  const note = notes.find((n) => n.group === 'today') ?? notes[0]
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) =>
    String(DAY_START / 60 + i).padStart(2, '0')
  )
  const doneLabel = `${data.doneCount}/${data.total} done`

  return (
    <main className="panel today">
      <Topbar icon="clock" section="Today" current={`${weekdayLong(appToday())} plan`} />

      <div className="panel-scroll">
        <PageHead
          date={pageDate()}
          title={`${greeting()}, ${who.first}`}
          sub={sub}
          stats={[
            ['Day score', data.score === null ? '—' : `${data.score}/100`],
            ['Focus', data.focusMin ? fmtMin(data.focusMin) : '—'],
            ['Done', `${data.doneCount}/${data.total}`]
          ]}
        />

        {view !== 'list' && (
          <>
            <div className="tv-head">
              <h2 className="today-h2">Plan</h2>
              <span className="mono muted" style={{ fontSize: 13 }}>
                {doneLabel}
              </span>
              <Segmented
                items={[
                  { id: 'list', label: 'List' },
                  { id: 'board', label: 'Board' }
                ]}
                value={view}
                onChange={setView}
              />
            </div>
            <TodayBoard
              plan={data.plan}
              onOpen={(id) => useUI.getState().openTask(id)}
              onMove={(id, start, len) => placeTask(id, toMinutes(start), len)}
              onDone={(id) => useTasks.getState().remove(id)}
            />
          </>
        )}

        {/* Day strip */}
        {view === 'list' && (
          <>
            <section className="strip">
              <div className="strip-head">
                <h2>Day strip</h2>
                <span className="muted" style={{ fontSize: 12 }}>
                  {T('07:00 – 23:00')}
                </span>
                <div className="legend">
                  {data.legend.map((l) => (
                    <div className="legend-item" key={l.label}>
                      <div className="dot" style={{ background: l.color }} />
                      <span>{l.label}</span>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ marginLeft: 'auto', gap: 7 }}>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    Energy curve
                  </span>
                  <Toggle on={energy} onChange={setEnergy} />
                </div>
              </div>

              <div className="strip-box">
                <div className="strip-cards">
                  {layoutLanes(data.strip).map(({ item, lane, lanes }) => {
                    const from = Math.max(item.start, DAY_START)
                    const to = Math.min(item.end, DAY_END)
                    if (to <= from) return null
                    const span = DAY_END - DAY_START
                    return (
                      <div
                        className="dslot"
                        key={item.key}
                        style={{
                          left: `${((from - DAY_START) / span) * 100}%`,
                          width: `${((to - from) / span) * 100}%`,
                          top: `${(lane * 100) / lanes}%`,
                          height: `${100 / lanes}%`
                        }}
                      >
                        <div
                          className={cn('dcard', item.kind, (lanes > 1 || to - from < 90) && 'tight')}
                          title={item.hint ? `${item.title} · ${T(item.hint)}` : item.title}
                        >
                          {item.kind === 'free' ? (
                            <span>{item.title}</span>
                          ) : (
                            <>
                              <span className="dcard-t">{item.title}</span>
                              <span className="dcard-h">{T(item.hint)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {nowMin >= DAY_START && nowMin <= DAY_END && (
                    <div
                      className="strip-now"
                      style={{ left: `${((nowMin - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}
                    />
                  )}
                </div>
                <svg
                  width="100%"
                  height="36"
                  viewBox="0 0 1600 36"
                  preserveAspectRatio="none"
                  style={{ opacity: energy ? 1 : 0 }}
                >
                  <path
                    d="M0,30 C120,24 200,4 310,3 C420,2 540,26 690,29 C820,32 900,12 1010,10 C1150,8 1330,32 1600,34 L1600,36 L0,36Z"
                    fill="#F38020"
                    fillOpacity=".07"
                  />
                  <path
                    d="M0,30 C120,24 200,4 310,3 C420,2 540,26 690,29 C820,32 900,12 1010,10 C1150,8 1330,32 1600,34"
                    fill="none"
                    stroke="#F38020"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div className="hours">
                {hours.map((h) => (
                  <span className="hour" key={h}>
                    {T(`${h}:00`).replace(':00', '')}
                  </span>
                ))}
              </div>

              {nextGap && (
                <div className="insight">
                  <span style={{ color: '#E2680C', display: 'flex' }}>
                    <Icon name="bolt" size={18} />
                  </span>
                  <p>
                    {T(`You are free ${clock(nextGap.start)}–${clock(nextGap.end)} (${fmtMin(nextGap.end - nextGap.start)}).`)}
                    {data.noTimeCount > 0 &&
                      ` ${data.noTimeCount} ${data.noTimeCount === 1 ? 'task has' : 'tasks have'} no time yet.`}
                  </p>
                  {data.noTimeCount > 0 && (
                    <div className="row" style={{ gap: 8 }}>
                      <button className="insight-btn dark" onClick={() => openDialog('autoSchedule')}>
                        Fill the gap
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Plan + side */}
            <div className="today-body">
              <section className="plan">
                <div className="plan-head">
                  <h2 className="today-h2">Plan</h2>
                  <span className="mono muted" style={{ fontSize: 13 }}>
                    {doneLabel}
                  </span>
                  <Segmented
                    items={[
                      { id: 'list', label: 'List' },
                      { id: 'board', label: 'Board' }
                    ]}
                    value={view}
                    onChange={setView}
                  />
                </div>

                {data.plan.length === 0 && !ghostTask && (
                  <span className="muted" style={{ fontSize: 13, padding: '14px 0' }}>
                    No tasks for today. Capture one below or plan from Tasks.
                  </span>
                )}
                {listGroups(ghostTask && !data.plan.some((g) => g.id === 'anytime')
                  ? [...data.plan, { id: 'anytime', title: 'Anytime', link: undefined, tasks: [] }]
                  : data.plan
                ).map((g) => (
                  <div key={g.id} className="col">
                    <div className="grp">
                      <span className="grp-t">{g.title}</span>
                      <div className="grp-line" />
                    </div>
                    {g.id === 'anytime' && ghostTask && (
                      <TaskRow
                        compact
                        enter
                        title={ghostTask.title}
                        project={ghostTask.project}
                        time="—"
                      />
                    )}
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        id={t.id}
                        enter={fresh.has(t.id)}
                        stay
                        compact
                        title={t.title}
                        project={t.project}
                        time={t.time}
                        done={t.done}
                        hot={t.hot}
                        onOpen={t.done ? undefined : () => useUI.getState().openTask(t.id)}
                        onToggle={() => (t.done ? useTasks.getState().reopen(t.id) : useTasks.getState().remove(t.id))}
                      />
                    ))}
                  </div>
                ))}
              </section>

              <aside className="today-side">
                <div className="upnext">
                  <div className="row" style={{ gap: 8 }}>
                    <div
                      className="findtime-dot"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--acc)',
                        boxShadow: '0 0 0 4px var(--acc-soft)'
                      }}
                    />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {data.upNext ? `Up next · ${inText(data.upNext.inMin)}` : 'Up next'}
                    </span>
                  </div>
                  {data.upNext ? (
                    <>
                      <span style={{ fontSize: 20, fontWeight: 500, marginTop: 10 }}>
                        {data.upNext.title}
                      </span>
                      <span className="mono muted" style={{ fontSize: 12.5 }}>
                        {T(data.upNext.meta)}
                        {data.upNext.kind === 'task' ? ' · Task' : ''}
                      </span>
                    </>
                  ) : (
                    <span className="muted" style={{ fontSize: 14, marginTop: 10 }}>
                      Nothing else is scheduled today.
                    </span>
                  )}
                  {data.openCount > 0 && (
                    <button
                      className="btn"
                      style={{ marginTop: 14, alignSelf: 'flex-start' }}
                      onClick={() => navigate(data.upNext?.taskId ? `/focus/${data.upNext.taskId}` : '/focus')}
                    >
                      <Icon name="clock" size={15} />
                      <span>Start focus</span>
                    </button>
                  )}
                </div>

                <div className="col">
                  <div className="side-head">
                    <h2>Habits</h2>
                    <a href="#/habits" className="muted side-link">
                      View all
                    </a>
                  </div>
                  <div
                    className="row"
                    style={{ gap: 4, justifyContent: 'flex-end', marginBottom: 2 }}
                  >
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <span className="dayl" key={i}>
                        {d}
                      </span>
                    ))}
                  </div>
                  {habits.length === 0 && (
                    <span className="muted" style={{ fontSize: 13, padding: '10px 0' }}>
                      No habits yet.
                    </span>
                  )}
                  {habits.map((h, i) => (
                    <div className={cn('hab', i === habits.length - 1 && 'last')} key={h.id}>
                      <div className="col" style={{ flex: 1 }}>
                        <span style={{ fontSize: 13.5 }}>{h.name}</span>
                        <span className="mono muted" style={{ fontSize: 11.5 }}>
                          {h.streak > 0 ? `${h.streak}-day streak` : 'No streak yet'}
                        </span>
                      </div>
                      <div className="wk">
                        {cellsFor(h.id, h.doneToday).map((c, n) =>
                          n === todayIdx ? (
                            <button
                              key={n}
                              className={cn('cell', c)}
                              aria-label={h.doneToday ? 'Undo today' : 'Mark done'}
                              onClick={() => useHabits.getState().toggleToday(h.id)}
                            />
                          ) : (
                            <div key={n} className={cn('cell', c)} />
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="col">
                  <div className="side-head">
                    <h2>Note of the day</h2>
                    <a href="#/notes" className="muted side-link">
                      Open notes
                    </a>
                  </div>
                  {note ? (
                    <>
                      <p style={{ fontSize: 19, lineHeight: 1.4, color: '#2A2A2A' }}>
                        {note.summary || note.title}
                      </p>
                      <span className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                        {note.title}
                        {note.linked ? ` · ${note.linked}` : ` · ${note.edited}`}
                      </span>
                    </>
                  ) : (
                    <span className="muted" style={{ fontSize: 13 }}>
                      No notes yet.
                    </span>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}

        <QuickCapture
          sticky
          placeholder={'Type anything… "coffee with Ece tomorrow 15:00 #personal"'}
          button="Send"
          hint={
            'Press Tab to accept the AI suggestion · try "coffee with Ece tomorrow 15:00 #personal"'
          }
          onTask={setGhostTask}
          onSubmit={captureTask}
        />
      </div>
    </main>
  )
}
