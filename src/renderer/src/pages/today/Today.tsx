import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { TaskRow } from '../../components/TaskRow'
import { Segmented, Toggle, cn } from '../../components/ui'
import { TodayBoard, TodayCalendar } from './TodayViews'
import type { GhostTask } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { parseCapture, toTask } from '../../lib/capture'
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
  layoutLanes
} from '../../lib/today'
import './today.css'
import { greeting, useIdentity } from '../../lib/identity'
import { T } from '../../lib/prefs'

type View = 'list' | 'board' | 'calendar'

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
  const storedHabits = useHabits((s) => s.habits)
  const history = useHabits((s) => s.history)
  const habits = storedHabits.map((h) => (supabase ? { ...h, ...habitNumbers(h, history, now) } : h))
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
            <div className={cn('tv-head', view === 'calendar' && 'cal')}>
              <h2 className="today-h2">Plan</h2>
              <span className="mono muted" style={{ fontSize: 13 }}>
                {doneLabel}
              </span>
              <Segmented
                items={[
                  { id: 'list', label: 'List' },
                  { id: 'board', label: 'Board' },
                  { id: 'calendar', label: 'Calendar' }
                ]}
                value={view}
                onChange={setView}
              />
            </div>
            {view === 'board' ? (
              <TodayBoard plan={data.plan} onOpen={(id) => navigate(`/tasks/${id}`)} />
            ) : (
              <TodayCalendar data={data} nowMin={nowMin} />
            )}
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
                      { id: 'board', label: 'Board' },
                      { id: 'calendar', label: 'Calendar' }
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
                {(ghostTask && !data.plan.some((g) => g.id === 'anytime')
                  ? [...data.plan, { id: 'anytime', title: 'Anytime', link: undefined, tasks: [] }]
                  : data.plan
                ).map((g) => (
                  <div key={g.id} className="col">
                    <div className="grp">
                      <span className="grp-t">{g.title}</span>
                      {g.link && (
                        <div className="grp-link">
                          <Icon name="link" size={12} strokeWidth={2} />
                          <span>{T(g.link)}</span>
                        </div>
                      )}
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
                        compact
                        title={t.title}
                        project={t.project}
                        time={t.time}
                        done={t.done}
                        hot={t.hot}
                        onOpen={t.done ? undefined : () => navigate(`/tasks/${t.id}`)}
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
                        {cellsFor(h.id, h.doneToday).map((c, n) => (
                          <div key={n} className={cn('cell', c)} />
                        ))}
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
          onSubmit={(text) => {
            const { task, group } = toTask(parseCapture(text))
            useTasks.getState().add(task, group)
          }}
        />
      </div>
    </main>
  )
}
