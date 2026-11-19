import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { cn } from '../../components/ui'
import './focus.css'

const subtasks = [
  { t: 'Pick the strongest layout from last week', done: true },
  { t: 'Variation A: day strip first', done: false, tag: 'Now' },
  { t: 'Variation B and C: list first, board first', done: false }
]

const pad = (n: number): string => String(n).padStart(2, '0')

export default function Focus(): React.JSX.Element {
  const navigate = useNavigate()
  const [remaining, setRemaining] = useState(24 * 60 + 18)
  const [total, setTotal] = useState(25 * 60)
  const [running, setRunning] = useState(true)
  const [len, setLen] = useState(0)
  const [subs, setSubs] = useState(subtasks.map((s) => s.done))
  const back = (): void => void navigate('/today')

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setRemaining((r) => Math.max(r - 1, 0)), 1000)
    return () => clearInterval(t)
  }, [running])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') back()
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setRunning((r) => !r)
      } else if (e.metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickLen = (i: number): void => {
    setLen(i)
    const secs = [25, 50, 90][i] * 60
    setTotal(secs)
    setRemaining(secs)
  }
  const elapsed = total - remaining
  const progress = Math.min(35 + (elapsed / total) * 65, 100)
  const doneCount = subs.filter(Boolean).length

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
                <span>Notifications paused until 15:25</span>
              </div>
              <button className="fc-btn" onClick={back}>
                End session
              </button>
            </div>
          </div>

          <div className="col fc-rise" style={{ width: 600, margin: '0 auto', paddingTop: 56, alignItems: 'center', flex: 'none' }}>
            <div className="row" style={{ gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--acc)' }} />
              <span className="muted" style={{ fontSize: 13 }}>
                Planner MVP · Deep work
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.25, textAlign: 'center', marginTop: 10 }}>
              Prepare 3 home screen variations for critique
            </h1>
            <span style={{ fontSize: 96, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums', marginTop: 36 }}>
              {pad(Math.floor(remaining / 60))}:{pad(remaining % 60)}
            </span>
            <span className="muted" style={{ fontSize: 13, marginTop: 12 }}>
              Session 2 of 4 · ends at 15:25
            </span>
            <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--line)', marginTop: 28 }}>
              <div className="fc-bar" style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--acc)', transform: `scaleX(${progress / 100})` }} />
            </div>
            <div className="row" style={{ gap: 10, marginTop: 28 }}>
              <button className="fc-btn dark" style={{ width: 132 }} onClick={() => setRunning(!running)}>
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
              <button className="fc-btn" onClick={() => (setRemaining((r) => r + 300), setTotal((t) => t + 300))}>
                +5 min
              </button>
              <button className="fc-btn" onClick={back}>
                <Icon name="check" size={14} strokeWidth={2.4} />
                <span>Mark done</span>
              </button>
            </div>
            <div className="fc-seg">
              {['25 min', '50 min', '90 min'].map((l, i) => (
                <button key={l} className={cn(i === len && 'on')} onClick={() => pickLen(i)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="col" style={{ width: 600, margin: '44px auto 0', flex: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>Subtasks</span>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {doneCount} of {subs.length}
              </span>
            </div>
            {subtasks.map((s, i) => (
              <div className="fc-sr" key={s.t} onClick={() => setSubs(subs.map((v, n) => (n === i ? !v : v)))}>
                <div className={cn('fc-cb', subs[i] && 'on')}>{subs[i] && <Icon name="check" size={12} strokeWidth={3} />}</div>
                <span style={subs[i] ? { flex: 1, color: 'var(--ink3)', textDecoration: 'line-through', textDecorationColor: '#BDBDBA' } : { flex: 1 }}>{s.t}</span>
                {s.tag && !subs[i] && (
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {s.tag}
                  </span>
                )}
              </div>
            ))}
            <div className="row" style={{ gap: 12, minHeight: 50, borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--ink2)', display: 'flex' }}>
                <Icon name="notes" size={16} strokeWidth={1.8} />
              </span>
              <span style={{ flex: 1 }}>Design critique prep</span>
              <span className="muted" style={{ fontSize: 12.5 }}>
                Linked note
              </span>
            </div>
            <div className="row" style={{ gap: 10, paddingTop: 18 }}>
              <span style={{ color: '#E2680C', display: 'flex' }}>
                <Icon name="bolt" size={14} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 13.5 }}>Up next: Design critique at 15:00. I will end this session at 14:55.</span>
            </div>
          </div>

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
