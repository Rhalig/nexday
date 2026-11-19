import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { cn, projectColor } from '../../components/ui'
import { projects, taskDetails, type Task } from '../../data/tasks'
import { useTasks } from '../../store/tasks'
import { useUI } from '../../store/ui'
import { useTodayData } from '../../lib/useToday'
import { T } from '../../lib/prefs'
import { clock } from '../../lib/today'
import './focus.css'

const pad = (n: number): string => String(n).padStart(2, '0')
const LENGTHS = [25, 50, 90]
/** "HH:MM" of a timestamp, in the user's time format */
const at = (ms: number): string => {
  const d = new Date(ms)
  return T(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
}

/** The task to work on: the one in the link, else today's next open task with a time, else the first open one. */
function pickTask(id: string | undefined, nowMin: number): Task | null {
  const groups = useTasks.getState().groups
  const all = groups.flatMap((g) => g.tasks)
  if (id) return all.find((t) => t.id === id) ?? null
  const today = groups.find((g) => g.id === 'today')?.tasks ?? []
  const start = (t: Task): number => {
    const m = t.time?.match(/^(\d{2}):(\d{2})/)
    return m ? Number(m[1]) * 60 + Number(m[2]) : -1
  }
  return today.filter((t) => start(t) >= nowMin).sort((a, b) => start(a) - start(b))[0] ?? today[0] ?? null
}

export default function Focus(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data, now } = useTodayData()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const groups = useTasks((s) => s.groups)
  const picked = useMemo(() => pickTask(id, nowMin), [id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Live copy, so ticking a subtask here shows at once
  const task = picked ? (groups.flatMap((g) => g.tasks).find((t) => t.id === picked.id) ?? picked) : null

  // The session shortens itself when something starts soon: it ends 5 minutes before the next item.
  const next = data.upNext
  const capMin = next && next.inMin - 5 >= 5 ? next.inMin - 5 : null
  const firstLen = capMin !== null && capMin < LENGTHS[0] ? capMin : LENGTHS[0]

  // Real time: the end is a clock time, so the display and the bar always agree with the wall clock.
  const [totalMs, setTotalMs] = useState(firstLen * 60000)
  const [endsAt, setEndsAt] = useState<number | null>(() => Date.now() + firstLen * 60000)
  const [heldMs, setHeldMs] = useState(firstLen * 60000) // time left while paused
  const [tick, setTick] = useState(() => Date.now())
  const [len, setLen] = useState(0)
  const running = endsAt !== null
  const remainingMs = running ? Math.max(endsAt - tick, 0) : heldMs

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setTick(Date.now()), 250)
    return () => clearInterval(t)
  }, [running])
  useEffect(() => {
    if (running && endsAt !== null && tick >= endsAt) {
      setEndsAt(null)
      setHeldMs(0)
    }
  }, [tick, running, endsAt])

  // Notifications are paused for the session and come back to what they were when it ends.
  const prevPause = useRef<boolean | null>(null)
  useEffect(() => {
    prevPause.current = useUI.getState().pauseNotifs
    useUI.setState({ pauseNotifs: true })
    const restore = (): void => {
      if (prevPause.current !== null) useUI.setState({ pauseNotifs: prevPause.current })
      prevPause.current = null
    }
    window.addEventListener('beforeunload', restore)
    return () => {
      window.removeEventListener('beforeunload', restore)
      restore()
    }
  }, [])

  const back = (): void => void navigate('/today')
  const finish = (): void => {
    if (task) useTasks.getState().remove(task.id)
    back()
  }
  const toggleRun = (): void => {
    if (running) {
      setHeldMs(remainingMs)
      setEndsAt(null)
    } else if (heldMs > 0) {
      const t = Date.now()
      setTick(t)
      setEndsAt(t + heldMs)
    }
  }
  const addFive = (): void => {
    setTotalMs((t) => t + 300000)
    if (running && endsAt !== null) setEndsAt(endsAt + 300000)
    else setHeldMs((h) => h + 300000)
  }
  const pickLen = (i: number): void => {
    const ms = LENGTHS[i] * 60000
    setLen(i)
    setTotalMs(ms)
    const t = Date.now()
    setTick(t)
    setEndsAt(t + ms)
    setHeldMs(ms)
  }

  const keys = useRef({ toggleRun, finish, back })
  keys.current = { toggleRun, finish, back }
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') keys.current.back()
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        keys.current.toggleRun()
      } else if (e.metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        keys.current.finish()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const secs = Math.ceil(remainingMs / 1000)
  const progress = totalMs > 0 ? Math.min(Math.max((totalMs - remainingMs) / totalMs, 0), 1) : 0
  const subs = task?.subtasks ?? []
  const subDone = subs.filter((s) => s.done).length
  const toggleSub = (sid: string): void => {
    if (task) useTasks.getState().setSubtasks(task.id, subs.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)))
  }
  const linkedNote = task ? taskDetails[task.title]?.linkedNote : undefined
  const untilText = running && endsAt !== null ? `Notifications paused until ${at(endsAt)}` : 'Notifications paused'
  const finished = !running && heldMs === 0

  return (
    <>
      <div className="drag-strip" />
      <div className="fc">
        <div className="fc-panel">
          <div className="row" style={{ justifyContent: 'space-between', flex: 'none' }}>
            <div className="row" style={{ gap: 10, paddingLeft: 24 }}>
              <button className="fc-btn" onClick={back}>
                <Icon name="arrowLeft" size={14} strokeWidth={2} />
                <span>Back to Today</span>
              </button>
              <span className="fc-kbd">esc</span>
            </div>
            <div className="row" style={{ gap: 14 }}>
              <div className="row muted" style={{ gap: 8, fontSize: 13 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
                <span>{untilText}</span>
              </div>
              <button className="fc-btn" onClick={back}>
                End session
              </button>
            </div>
          </div>

          {!task ? (
            <div className="col fc-rise" style={{ width: 460, margin: '0 auto', paddingTop: 120, alignItems: 'center', textAlign: 'center' }}>
              <h1 style={{ fontSize: 24, fontWeight: 500 }}>Nothing to focus on yet</h1>
              <span className="muted" style={{ fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
                Open a task and choose Start focus, or add a task for today first.
              </span>
              <button className="fc-btn dark" style={{ marginTop: 24 }} onClick={back}>
                Back to Today
              </button>
            </div>
          ) : (
            <>
              <div className="col fc-rise" style={{ width: 600, margin: '0 auto', paddingTop: 56, alignItems: 'center', flex: 'none' }}>
                <div className="row" style={{ gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: projectColor[task.project] }} />
                  <span className="muted" style={{ fontSize: 13 }}>
                    {projects[task.project].name} · {task.energy}
                  </span>
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.25, textAlign: 'center', marginTop: 10 }}>{task.title}</h1>
                <span style={{ fontSize: 96, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums', marginTop: 36 }}>
                  {pad(Math.floor(secs / 60))}:{pad(secs % 60)}
                </span>
                <span className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                  {finished ? 'Session complete' : running && endsAt !== null ? `Ends at ${at(endsAt)}` : 'Paused'}
                </span>
                <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--line)', marginTop: 28 }}>
                  <div className="fc-bar" style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--acc)', transform: `scaleX(${progress})` }} />
                </div>
                <div className="row" style={{ gap: 10, marginTop: 28 }}>
                  <button className="fc-btn dark" style={{ width: 132 }} onClick={toggleRun} disabled={finished}>
                    {running ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                        <path d="M7 4l13 8-13 8z" />
                      </svg>
                    )}
                    <span>{running ? 'Pause' : 'Resume'}</span>
                  </button>
                  <button className="fc-btn" onClick={addFive}>
                    +5 min
                  </button>
                  <button className="fc-btn" onClick={finish}>
                    <Icon name="check" size={14} strokeWidth={2.4} />
                    <span>Mark done</span>
                  </button>
                </div>
                <div className="fc-seg">
                  {LENGTHS.map((l, i) => (
                    <button key={l} className={cn(i === len && 'on')} onClick={() => pickLen(i)}>
                      {l} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="col" style={{ width: 600, margin: '44px auto 0', flex: 'none' }}>
                {subs.length > 0 && (
                  <>
                    <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>Subtasks</span>
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        {subDone} of {subs.length}
                      </span>
                    </div>
                    {subs.map((s) => (
                      <div className="fc-sr" key={s.id} onClick={() => toggleSub(s.id)}>
                        <div className={cn('fc-cb', s.done && 'on')}>{s.done && <Icon name="check" size={12} strokeWidth={3} />}</div>
                        <span style={s.done ? { flex: 1, color: 'var(--ink3)', textDecoration: 'line-through', textDecorationColor: '#BDBDBA' } : { flex: 1 }}>{s.title}</span>
                      </div>
                    ))}
                  </>
                )}
                {linkedNote && (
                  <div className="row" style={{ gap: 12, minHeight: 50, borderBottom: '1px solid var(--line)' }}>
                    <span style={{ color: 'var(--ink2)', display: 'flex' }}>
                      <Icon name="notes" size={16} strokeWidth={1.8} />
                    </span>
                    <span style={{ flex: 1 }}>{linkedNote.title}</span>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      Linked note
                    </span>
                  </div>
                )}
                {next && (
                  <div className="row" style={{ gap: 10, paddingTop: 18 }}>
                    <span style={{ color: '#E2680C', display: 'flex' }}>
                      <Icon name="bolt" size={14} strokeWidth={2} />
                    </span>
                    <span style={{ fontSize: 13.5 }}>
                      Up next: {next.title} at {T(clock(nowMin + next.inMin))}.
                      {capMin !== null && capMin < LENGTHS[0] ? ' The session is shortened to finish before it.' : ''}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="row muted" style={{ marginTop: 'auto', paddingTop: 28, gap: 18, fontSize: 12, justifyContent: 'center', flex: 'none' }}>
            <span className="row" style={{ gap: 6 }}>
              <span className="fc-kbd">Space</span>Pause
            </span>
            <span className="row" style={{ gap: 6 }}>
              <span className="fc-kbd">⌘D</span>Mark done
            </span>
            <span className="row" style={{ gap: 6 }}>
              <span className="fc-kbd">esc</span>Exit
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
