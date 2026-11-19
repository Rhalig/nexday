import { useNavigate } from 'react-router-dom'
import { PageHead, Topbar } from '../../components/page'
import { QuickCapture } from '../../components/QuickCapture'
import { Button } from '../../components/ui'
import { useUI } from '../../store/ui'
import { captureTask } from '../../lib/quickTask'
import { pageDate } from '../../lib/clock'
import './tasks.css'
import './tasks-states.css'

const placeholder = 'Add a task… "pay electricity bill Friday 12:00 #moving"'
const addTask = captureTask
const hint = 'Nexday reads the day, time and project from plain language.'

export function TasksEmpty(): React.JSX.Element {
  const navigate = useNavigate()
  const openNew = useUI((s) => s.openNew)
  return (
    <main className="panel">
      <Topbar icon="tasks" section="Tasks" current="All open" />
      <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <PageHead
          date={pageDate()}
          title="Tasks"
          sub="0 open tasks. Everything you planned is done."
        />
        <div
          className="col"
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            textAlign: 'center'
          }}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#BDBDBA"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l3 3 5-6" />
          </svg>
          <span style={{ fontSize: 20, fontWeight: 500, marginTop: 6 }}>
            You&apos;re all caught up
          </span>
          <span style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.5, maxWidth: 380 }}>
            Nothing left to do today. Add a task below, or let Nexday pull new ones from your inbox
            and notes.
          </span>
          <div className="row" style={{ gap: 12, marginTop: 14 }}>
            <Button onClick={() => navigate('/inbox')}>Go to Inbox</Button>
            <Button variant="dark" onClick={() => openNew('task')}>
              New task
            </Button>
          </div>
        </div>
        <QuickCapture placeholder={placeholder} button="Add" hint={hint} onSubmit={addTask} />
      </div>
    </main>
  )
}

const failing: Array<{ group: string; meta: string; rows: Array<[string, string]> }> = [
  {
    group: 'Today',
    meta: '3 · 1h 30m',
    rows: [
      ['Sketch empty state screens', 'Planner MVP'],
      ['Prepare 3 home screen variations for critique', 'Planner MVP'],
      ['Finish chapter 4 for book club', 'Reading list']
    ]
  },
  {
    group: 'Tomorrow',
    meta: '3 · 1h 20m',
    rows: [
      ['Pay rent', 'Moving house'],
      ["Reply to Mert's Slack message", 'Planner MVP'],
      ['Write onboarding copy', 'Planner MVP']
    ]
  }
]

export function TasksSyncError(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <main className="panel ts-nr">
      <Topbar icon="tasks" section="Tasks" current="All open" sync="error" />
      <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <PageHead
          date={pageDate()}
          title="Tasks"
          sub="12 open tasks. Times are saved here, but not on your calendar."
        />
        <div className="row" style={{ gap: 16, marginTop: 26, padding: '16px 0' }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C2362B"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16.5v.5" />
          </svg>
          <div className="col" style={{ flex: 1, gap: 2 }}>
            <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--err)' }}>
              Google Calendar sync failed
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink2)' }}>
              Your sign-in expired at 09:41. Changes you make are kept and will sync once you
              reconnect.
            </span>
          </div>
          <Button>Retry</Button>
          <Button variant="dark" onClick={() => navigate('/settings/calendars')}>
            Reconnect
          </Button>
        </div>
        {failing.map((g) => (
          <div className="col" key={g.group}>
            <div className="ts-gh">
              {g.group}
              <i>{g.meta}</i>
            </div>
            {g.rows.map(([name, project]) => (
              <div className="ts-t" key={name}>
                <span className="ts-cb" />
                <span className="n">{name}</span>
                <span className="e">{project}</span>
                <span className="w">Not on calendar</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <QuickCapture placeholder={placeholder} button="Add" hint={hint} onSubmit={addTask} />
      </div>
    </main>
  )
}

const skeletonRows: Array<[number, number, number]> = [
  [260, 90, 80],
  [120, 90, 80],
  [340, 90, 80],
  [210, 90, 80]
]

export function TasksLoading(): React.JSX.Element {
  const row = (w: number, i: number): React.JSX.Element => (
    <div className="ts-sr" key={i}>
      <div className="ts-sk" style={{ width: 18, height: 18 }} />
      <div className="ts-sk" style={{ width: w, height: 14 }} />
      <span style={{ flex: 1 }} />
      <div className="ts-sk" style={{ width: 90, height: 12 }} />
      <div className="ts-sk" style={{ width: 80, height: 12, marginLeft: 30 }} />
    </div>
  )
  return (
    <main className="panel">
      <Topbar icon="tasks" section="Tasks" current="All open" sync="loading" />
      <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <header className="page-head default">
          <div className="col" style={{ gap: 6 }}>
            <span className="muted">{pageDate()}</span>
            <h1>Tasks</h1>
            <div className="ts-sk" style={{ width: 260, height: 14, marginTop: 6 }} />
          </div>
        </header>
        <div className="row" style={{ marginTop: 26, gap: 8 }}>
          <div className="ts-sk" style={{ width: 240, height: 34, borderRadius: 10 }} />
        </div>
        <div className="ts-sk" style={{ width: 90, height: 13, margin: '30px 0 14px' }} />
        {skeletonRows.map(([w], i) => row(w, i))}
        <div className="ts-sk" style={{ width: 100, height: 13, margin: '34px 0 14px' }} />
        {row(180, 10)}
        {row(300, 11)}
        <div style={{ flex: 1 }} />
        <QuickCapture placeholder={placeholder} button="Add" hint="" onSubmit={addTask} />
      </div>
    </main>
  )
}
