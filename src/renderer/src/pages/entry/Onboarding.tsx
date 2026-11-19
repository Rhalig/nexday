import { type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { create } from 'zustand'
import googleCal from '../../assets/gcal.svg'
import appleIcon from '../../assets/apple.svg'
import outlookIcon from '../../assets/outlook.png'
import { useAuth } from '../../store/auth'
import { useProjects } from '../../store/projects'
import { useCalendar } from '../../store/calendar'
import { Brand } from './Entry'
import './entry.css'

const tick = (s: number, w: number, c = '#fff'): React.JSX.Element => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5 9-10" />
  </svg>
)

const colors = ['var(--acc)', 'var(--work)', 'var(--health)', 'var(--personal)', 'var(--blue)']

type OB = {
  uses: boolean[]
  connected: Record<string, boolean>
  days: boolean[]
  focus: number
  project: string
  color: number
  due: string
  template: number
  set: (p: Partial<OB>) => void
}
const useOB = create<OB>((set) => ({
  uses: [true, true, false, true],
  connected: {},
  days: [true, true, true, true, true, false, false],
  focus: 0,
  project: 'Planner MVP',
  color: 0,
  due: 'Dec 18, 2026',
  template: 0,
  set: (p) => set(p)
}))

function Shell({ step, width, children }: { step: number; width: number; children: ReactNode }): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <>
      <div className="drag-strip" />
      <div className="nx-en">
        <div className="nx-panel stack">
          <div className="ob-top">
            <Brand />
            <div className="r">
              <span>Step {step} of 5</span>
              {step < 5 && (
                <a className="lnk" style={{ color: 'var(--ink2)' }} onClick={() => navigate('/today')}>
                  Skip setup
                </a>
              )}
            </div>
          </div>
          <div className="ob-body" style={{ width }}>
            <div className="ob-segs">
              {[1, 2, 3, 4, 5].map((n) => (
                <i key={n} className={n <= step ? 'on' : undefined} />
              ))}
            </div>
            <div key={step} className="ob-step">
              {children}
            </div>
          </div>
          <div style={{ height: 20, flex: 'none' }} />
        </div>
      </div>
    </>
  )
}

const Head = ({ title, sub }: { title: string; sub: string }): React.JSX.Element => (
  <>
    <h1>{title}</h1>
    <p className="nx-sub">{sub}</p>
  </>
)

function Nav({ back, next, nextLabel = 'Continue', skip }: { back?: () => void; next: () => void; nextLabel?: string; skip?: () => void }): React.JSX.Element {
  return (
    <div className="ob-nav">
      {back ? (
        <button className="nx-btn auto" onClick={back}>
          Back
        </button>
      ) : (
        <span />
      )}
      <div className="r">
        {skip && (
          <a className="lnk" style={{ fontSize: 13, color: 'var(--ink2)' }} onClick={skip}>
            Skip for now
          </a>
        )}
        <button className="nx-btn auto dark" style={{ padding: '0 20px' }} onClick={next}>
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

const Sgm = ({ items, on, onPick }: { items: string[]; on: number; onPick: (i: number) => void }): React.JSX.Element => (
  <div className="ob-sgm">
    {items.map((t, i) => (
      <span key={t} className={i === on ? 'on' : undefined} onClick={() => onPick(i)}>
        {t}
      </span>
    ))}
  </div>
)

export default function Onboarding(): React.JSX.Element {
  const { step: stepParam } = useParams()
  const step = Number(stepParam)
  const navigate = useNavigate()
  const ob = useOB()
  const auth = useAuth()
  const addProject = useProjects((s) => s.add)
  const cal = useCalendar()
  const name = auth.name.split(' ')[0] || 'there'
  const go = (n: number) => (): void => void navigate(`/onboarding/${n}`)

  if (![1, 2, 3, 4, 5].includes(step)) return <Navigate to="/onboarding/1" replace />

  if (step === 1) {
    const opts: Array<[string, string]> = [
      ['Work and meetings', 'Calls, deadlines, focus blocks'],
      ['Side projects', 'Things you build outside of work'],
      ['Studies', 'Classes, exams, reading'],
      ['Personal life', 'Health, errands, time with people']
    ]
    return (
      <Shell step={1} width={520}>
        <Head title={`Welcome to Nexday, ${name}`} sub="What will you plan here? Pick as many as you like. Setup takes two minutes." />
        <div className="ob-list">
          {opts.map(([t, s], i) => (
            <div className="ob-opt" key={t} onClick={() => ob.set({ uses: ob.uses.map((v, n) => (n === i ? !v : v)) })}>
              <div className="col" style={{ flex: 1 }}>
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{t}</span>
                <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{s}</span>
              </div>
              <div className={ob.uses[i] ? 'ob-chk on' : 'ob-chk'}>{ob.uses[i] && tick(11, 3.2)}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 32 }}>
          <button className="nx-btn auto dark" style={{ padding: '0 20px' }} onClick={go(2)}>
            Continue
          </button>
        </div>
      </Shell>
    )
  }

  if (step === 2) {
    const macOk = cal.status === 'authorized'
    const toggle = (): void => void cal.connect()
    const src = (key: string, icon: ReactNode, title: string, sub: string, label: string): React.JSX.Element => (
      <div className="ob-src" key={key}>
        {icon}
        <div className="col" style={{ flex: 1 }}>
          <span style={{ fontSize: 14.5, fontWeight: 500 }}>{title}</span>
          <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{sub}</span>
        </div>
        {key !== 'mac' ? (
          <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>via Mac</span>
        ) : macOk ? (
          <div className="row" style={{ gap: 6, color: 'var(--acc-text)', fontSize: 13, fontWeight: 500 }}>
            {tick(14, 2.6, 'currentColor')}Connected
          </div>
        ) : (
          <button className="nx-btn auto" onClick={toggle}>
            {label}
          </button>
        )}
      </div>
    )
    return (
      <Shell step={2} width={520}>
        <Head title="Connect your calendar" sub="Nexday plans around the events you already have. It reads times and titles only." />
        <div className="ob-list">
          {src(
            'mac',
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8M12 16v4" />
            </svg>,
            'Calendar on this Mac',
            'Uses the accounts already in Calendar. Asks for access once.',
            'Allow access'
          )}
          {src('google', <img src={googleCal} width={28} height={28} alt="" />, 'Google Calendar', 'Add the account to your Mac and it shows up here', '')}
          {src('apple', <img src={appleIcon} width={24} height={24} alt="" style={{ margin: '0 2px' }} />, 'Apple Calendar', 'iCloud calendars', '')}
          {src('outlook', <img src={outlookIcon} width={28} height={28} alt="" />, 'Outlook', 'Microsoft 365 and Outlook.com', '')}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 20 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#767676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Read-only by default. You can disconnect any time in Settings.</span>
        </div>
        <Nav back={go(1)} next={go(3)} skip={go(3)} />
      </Shell>
    )
  }

  if (step === 3) {
    const row = (label: string, body: ReactNode): React.JSX.Element => (
      <div className="ob-prop">
        <span className="ob-pl">{label}</span>
        {body}
      </div>
    )
    const time = (a: string, b: string): React.JSX.Element => (
      <div className="row" style={{ gap: 10 }}>
        <span className="ob-time">{a}</span>
        <span style={{ color: 'var(--ink3)' }}>to</span>
        <span className="ob-time">{b}</span>
      </div>
    )
    return (
      <Shell step={3} width={560}>
        <Head title="When do you work?" sub="Nexday only schedules tasks inside these hours." />
        <div className="ob-list">
          {row(
            'Days',
            <div className="row" style={{ gap: 6 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                <span key={d} className={ob.days[i] ? 'ob-day on' : 'ob-day'} onClick={() => ob.set({ days: ob.days.map((v, n) => (n === i ? !v : v)) })}>
                  {d}
                </span>
              ))}
            </div>
          )}
          {row('Work hours', time('09:00', '18:00'))}
          {row('Lunch break', time('12:30', '13:30'))}
          {row('Best focus time', <Sgm items={['Morning', 'Afternoon', 'Evening']} on={ob.focus} onPick={(i) => ob.set({ focus: i })} />)}
        </div>
        <Nav back={go(2)} next={go(4)} />
      </Shell>
    )
  }

  if (step === 4) {
    const row = (label: string, body: ReactNode): React.JSX.Element => (
      <div className="ob-prop">
        <span className="ob-pl">{label}</span>
        {body}
      </div>
    )
    return (
      <Shell step={4} width={560}>
        <Head title="Start with one project" sub="Projects group tasks, notes and events. You can add more later." />
        <div className="ob-list">
          {row(
            'Name',
            <label className="nx-field" style={{ flex: 1 }}>
              <input type="text" value={ob.project} onChange={(e) => ob.set({ project: e.target.value })} />
            </label>
          )}
          {row(
            'Color',
            <div className="row" style={{ gap: 12 }}>
              {colors.map((c, i) => (
                <span key={c} className={ob.color === i ? 'ob-sw on' : 'ob-sw'} style={{ background: c }} onClick={() => ob.set({ color: i })} />
              ))}
            </div>
          )}
          {row(
            'Due date',
            <label className="nx-field" style={{ flex: 1 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M3 9h18M8 2v4M16 2v4" />
              </svg>
              <input type="text" value={ob.due} onChange={(e) => ob.set({ due: e.target.value })} />
            </label>
          )}
          {row('Start from', <Sgm items={['Blank', 'Product launch', 'Personal plan']} on={ob.template} onPick={(i) => ob.set({ template: i })} />)}
        </div>
        <Nav
          back={go(3)}
          nextLabel="Create project"
          skip={go(5)}
          next={() => {
            const n = ob.project.trim()
            if (n && !['planner mvp', 'moving house', 'reading list'].includes(n.toLowerCase())) addProject(n, colors[ob.color])
            navigate('/onboarding/5')
          }}
        />
      </Shell>
    )
  }

  const prop = (label: string, body: ReactNode): React.JSX.Element => (
    <div className="ob-prop s">
      <span className="ob-pl">{label}</span>
      {body}
    </div>
  )
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const on = dayNames.filter((_, i) => ob.days[i])
  const daysText = on.length === 0 ? 'No work days' : on.length === 5 && !ob.days[5] && !ob.days[6] ? 'Mon to Fri' : on.join(', ')
  return (
    <Shell step={5} width={520}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F38020" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M8 12.5l3 3 5-6" />
      </svg>
      <h1 style={{ marginTop: 16 }}>You&apos;re all set, {name}</h1>
      <p className="nx-sub">Your plan is ready. Add tasks, and Nexday fits them into the gaps in your day.</p>
      <div className="ob-list">
        {prop('Working hours', <span className="ob-pv">{daysText}, 09:00 to 18:00</span>)}
        {prop('Best focus time', <span className="ob-pv">{['Mornings', 'Afternoons', 'Evenings'][ob.focus]}</span>)}
        {prop(
          'First project',
          <div className="row" style={{ gap: 8, flex: 1 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[ob.color] }} />
            <span className="ob-pv" style={{ flex: 'none' }}>
              {ob.project || 'Untitled'}
            </span>
            <span style={{ color: 'var(--ink3)', fontSize: 13 }}>Due {ob.due.replace(/, \d{4}$/, '')}</span>
          </div>
        )}
      </div>
      <div className="ob-nav">
        <button className="nx-btn auto" onClick={go(4)}>
          Back
        </button>
        <button className="nx-btn auto dark" style={{ padding: '0 20px' }} onClick={() => navigate('/today')}>
          Go to Today
        </button>
      </div>
    </Shell>
  )
}
