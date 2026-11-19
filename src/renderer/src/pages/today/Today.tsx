import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { TaskRow } from '../../components/TaskRow'
import { Button, Segmented, Toggle, cn } from '../../components/ui'
import type { Project } from '../../data/tasks'
import { TodayBoard, TodayCalendar } from './TodayViews'
import type { GhostTask } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { parseCapture, toTask } from '../../lib/capture'
import { useTasks } from '../../store/tasks'
import { appToday, pageDate, weekdayLong } from '../../lib/clock'
import './today.css'

type Slot = {
  w: string
  card?: {
    kind: 'health' | 'work' | 'personal' | 'moved' | 'free'
    title: string
    hint?: string
    movedHint?: boolean
  }
}

const slots: Slot[] = [
  { w: '6.25%', card: { kind: 'health', title: 'Run', hint: '07:00' } },
  { w: '6.25%' },
  {
    w: '12.5%',
    card: { kind: 'moved', title: 'Deep work · Onboarding', hint: '09:00 – 11:00', movedHint: true }
  },
  { w: '3.125%' },
  { w: '6.25%', card: { kind: 'work', title: 'Product sync', hint: '11:30' } },
  { w: '3.125%' },
  { w: '12.5%', card: { kind: 'free', title: 'Free · 2h' } },
  { w: '9.375%', card: { kind: 'work', title: 'Design critique', hint: '15:00 – 16:30' } },
  { w: '3.125%' },
  {
    w: '6.25%',
    card: { kind: 'moved', title: 'Pitch draft', hint: '17:00 · moved', movedHint: true }
  },
  { w: '9.375%' },
  { w: '6.25%', card: { kind: 'personal', title: 'Book club', hint: '19:30' } }
]

const legend = [
  { color: 'var(--acc)', label: 'Focus 3h' },
  { color: 'var(--work)', label: 'Meetings 2h 30m' },
  { color: 'var(--health)', label: 'Health 1h' },
  { color: 'var(--personal)', label: 'Personal 1h' },
  { color: '#CFCFCC', label: 'Free 2h' }
]

const hours = [
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22'
]

type PlanTask = { title: string; project: Project; time: string; done?: boolean; hot?: boolean }
type PlanGroup = {
  id: string
  title: string
  link?: { icon: IconName; label: string }
  tasks: PlanTask[]
}

const plan: PlanGroup[] = [
  {
    id: 'morning',
    title: 'Morning',
    link: { icon: 'target', label: 'Deep work 09:00' },
    tasks: [
      { title: 'Finish onboarding flow wireframes', project: 'planner', time: '45m', done: true },
      { title: 'Clean up user interview notes', project: 'planner', time: '20m', done: true },
      { title: 'Sketch empty state screens', project: 'planner', time: '30m' }
    ]
  },
  {
    id: 'afternoon',
    title: 'Afternoon',
    link: { icon: 'link', label: 'Design critique 15:00' },
    tasks: [
      {
        title: 'Prepare 3 home screen variations for critique',
        project: 'planner',
        time: '14:30',
        hot: true
      },
      { title: 'Send the prototype link to Ece', project: 'planner', time: '5m', done: true }
    ]
  },
  {
    id: 'anytime',
    title: 'Anytime',
    tasks: [
      { title: 'Get a quote from the moving company', project: 'moving', time: '—', done: true },
      { title: 'Finish chapter 4 for book club', project: 'reading', time: '18:00' }
    ]
  }
]

const habits: Array<{ name: string; meta: string; cells: Array<'y' | 't' | ''> }> = [
  { name: 'Morning run', meta: '12-day streak', cells: ['y', 'y', '', '', '', '', ''] },
  { name: 'Read 20 pages', meta: '5-day streak', cells: ['y', 't', '', '', '', '', ''] },
  { name: 'Phone-free evening', meta: 'Last week 4/7', cells: ['y', 't', '', '', '', '', ''] }
]

type View = 'list' | 'board' | 'calendar'

export default function Today(): React.JSX.Element {
  const navigate = useNavigate()
  const [energy, setEnergy] = useState(true)
  const [view, setView] = useState<View>('list')
  const [ghostTask, setGhostTask] = useState<GhostTask | null>(null)

  return (
    <main className="panel today">
      <Topbar icon="clock" section="Today" current={`${weekdayLong(appToday())} plan`} />

      <div className="panel-scroll">
        <PageHead
          date={pageDate()}
          title="Good morning, Umut"
          sub="4 events and 7 tasks today. You have a 2-hour gap this afternoon."
          stats={[
            ['Day score', '72/100'],
            ['Focus', '2h 40m'],
            ['Done', '4/7']
          ]}
        />

        {view !== 'list' && (
          <>
            <div className={cn('tv-head', view === 'calendar' && 'cal')}>
              <h2 className="today-h2">Plan</h2>
              <span className="mono muted" style={{ fontSize: 13 }}>
                4/7 done
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
              <TodayBoard plan={plan} onOpen={() => navigate('/tasks/t2')} />
            ) : (
              <TodayCalendar />
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
                  07:00 – 23:00
                </span>
                <div className="legend">
                  {legend.map((l) => (
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
                  {slots.map((s, i) => (
                    <div className="dslot" style={{ width: s.w }} key={i}>
                      {s.card && (
                        <div className={cn('dcard', s.card.kind)}>
                          {s.card.kind === 'free' ? (
                            <span>{s.card.title}</span>
                          ) : (
                            <>
                              <span className="dcard-t">{s.card.title}</span>
                              <span className={cn('dcard-h', s.card.movedHint && 'moved')}>
                                {s.card.hint}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="dslot" style={{ flex: 1 }} />
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
                    {h}
                  </span>
                ))}
              </div>

              <div className="insight">
                <span style={{ color: '#E2680C', display: 'flex' }}>
                  <Icon name="bolt" size={18} />
                </span>
                <p>
                  Your energy picks up again between 16:30 and 18:00. I moved Pitch draft to 17:00.
                  Email fits in the free 2 hours.
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="insight-btn">Undo</button>
                  <button className="insight-btn dark">Fill the gap</button>
                </div>
              </div>
            </section>

            {/* Plan + side */}
            <div className="today-body">
              <section className="plan">
                <div className="plan-head">
                  <h2 className="today-h2">Plan</h2>
                  <span className="mono muted" style={{ fontSize: 13 }}>
                    4/7 done
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

                {plan.map((g) => (
                  <div key={g.id} className="col">
                    <div className="grp">
                      <span className="grp-t">{g.title}</span>
                      {g.link && (
                        <div className="grp-link">
                          <Icon name={g.link.icon} size={12} strokeWidth={2} />
                          <span>{g.link.label}</span>
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
                        key={t.title}
                        compact
                        title={t.title}
                        project={t.project}
                        time={t.time}
                        done={t.done}
                        hot={t.hot}
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
                      Up next · in 50 min
                    </span>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 500, marginTop: 10 }}>Product sync</span>
                  <span className="mono muted" style={{ fontSize: 12.5 }}>
                    11:30–12:30 · Google Meet
                  </span>
                  <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
                    <div className="row" style={{ paddingLeft: 6 }}>
                      <div className="av" style={{ background: '#5B6578' }}>
                        <span>E</span>
                      </div>
                      <div className="av" style={{ background: '#E2680C' }}>
                        <span>M</span>
                      </div>
                      <div className="av" style={{ background: '#767676' }}>
                        <span>+2</span>
                      </div>
                    </div>
                    <Button variant="dark">
                      <span>Join</span>
                    </Button>
                  </div>
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
                  {habits.map((h, i) => (
                    <div className={cn('hab', i === habits.length - 1 && 'last')} key={h.name}>
                      <div className="col" style={{ flex: 1 }}>
                        <span style={{ fontSize: 13.5 }}>{h.name}</span>
                        <span className="mono muted" style={{ fontSize: 11.5 }}>
                          {h.meta}
                        </span>
                      </div>
                      <div className="wk">
                        {h.cells.map((c, n) => (
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
                  <p style={{ fontSize: 19, lineHeight: 1.4, color: '#2A2A2A' }}>
                    &quot;Show the variations side by side in critique, not one by one. Save 10 min
                    for Ece&apos;s feedback.&quot;
                  </p>
                  <span className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    Yesterday 18:12 · Linked to Design critique
                  </span>
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
