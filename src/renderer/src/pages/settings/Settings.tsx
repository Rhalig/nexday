import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { DeleteAccountDialog, ImportDialog } from '../../components/Dialogs'
import { cn } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { useIdentity, timeZoneName } from '../../lib/identity'
import { useCalendar } from '../../store/calendar'
import { useUI } from '../../store/ui'
import { GO_TO, SHORTCUTS, comboOf, keycaps, problemWith, resolveShortcuts, type ShortcutId } from '../../lib/shortcuts'
import {
  buildJsonExport,
  buildTasksCsv,
  parseImport,
  saveExport,
  type ParsedImport
} from '../../lib/dataPorter'
import './settings.css'

const tabs = [
  ['profile', 'Profile'],
  ['preferences', 'Preferences'],
  ['planning', 'Planning'],
  ['calendars', 'Calendars & sync'],
  ['integrations', 'Integrations'],
  ['notifications', 'Notifications'],
  ['shortcuts', 'Shortcuts'],
  ['data', 'Data & privacy']
] as const

type Tab = (typeof tabs)[number][0]

/* ---------- small controls ---------- */

function Tg({
  init = false,
  on: controlled,
  onChange
}: {
  init?: boolean
  on?: boolean
  onChange?: (v: boolean) => void
}): React.JSX.Element {
  const [local, setLocal] = useState(init)
  const on = controlled !== undefined ? controlled : local
  return (
    <span
      className={cn('st-tg', on && 'on')}
      onClick={() => {
        if (onChange) onChange(!on)
        else setLocal(!on)
      }}
    />
  )
}
function Tg2({ init = true }: { init?: boolean }): React.JSX.Element {
  const [on, setOn] = useState(init)
  return (
    <span className={cn('st-tg2', !on && 'off')} onClick={() => setOn(!on)}>
      <i />
    </span>
  )
}
const chev = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#767676"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)
function Sel({
  w = 260,
  children,
  chevron = true
}: {
  w?: number
  children: ReactNode
  chevron?: boolean
}): React.JSX.Element {
  return (
    <span className="st-sel" style={{ minWidth: w }}>
      {children}
      {chevron && chev}
    </span>
  )
}
/** A Sel that cycles through its options on click (the design has no dropdown yet). */
function Cyc({
  value,
  options,
  onChange,
  w = 260
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  w?: number
}): React.JSX.Element {
  return (
    <span
      className="st-sel"
      style={{ minWidth: w, cursor: 'pointer' }}
      onClick={() => {
        const i = options.indexOf(value)
        onChange(options[(i + 1) % options.length])
      }}
    >
      {value}
      {chev}
    </span>
  )
}

function Seg({
  items,
  init = 0,
  value,
  onChange
}: {
  items: string[]
  init?: number
  value?: number
  onChange?: (i: number) => void
}): React.JSX.Element {
  const [local, setLocal] = useState(init)
  const i = value !== undefined ? value : local
  return (
    <div className="st-seg">
      {items.map((t, n) => (
        <span
          key={t}
          className={cn(n === i && 'on')}
          onClick={() => {
            if (onChange) onChange(n)
            else setLocal(n)
          }}
        >
          {t}
        </span>
      ))}
    </div>
  )
}
function Row({
  title,
  sub,
  end,
  children
}: {
  title: string
  sub: string
  end?: boolean
  children?: ReactNode
}): React.JSX.Element {
  return (
    <div className={cn('st-srow', end && 'end')}>
      <div className="st-l">
        <b>{title}</b>
        <span>{sub}</span>
      </div>
      {children}
    </div>
  )
}
function Head({
  title,
  sub,
  pb = 22
}: {
  title: string
  sub: string
  pb?: number
}): React.JSX.Element {
  return (
    <div className="col" style={{ gap: 3, paddingBottom: pb }}>
      <span style={{ fontSize: 18, fontWeight: 500 }}>{title}</span>
      <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>{sub}</span>
    </div>
  )
}
const Sp = (): React.JSX.Element => <span className="st-sp" />
const tick = (size: number, color: string, w: number): React.JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={w}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12l5 5 9-10" />
  </svg>
)

/* ---------- pages ---------- */

function NameField(): React.JSX.Element {
  const name = useAuth((s) => s.name)
  const rename = useAuth((s) => s.rename)
  const [value, setValue] = useState(name)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => setValue(name), [name])
  const save = async (): Promise<void> => {
    if (value.trim() === name) return
    const r = await rename(value)
    if (r.error) setNote(r.error)
    else setNote('Saved')
    setTimeout(() => setNote(null), 2500)
  }
  return (
    <span className="row" style={{ gap: 10 }}>
      {note && <span style={{ fontSize: 12.5, color: note === 'Saved' ? 'var(--ink3)' : 'var(--err)' }}>{note}</span>}
      <input
        className="st-sel st-in"
        style={{ minWidth: 320 }}
        value={value}
        maxLength={80}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </span>
  )
}

function Profile(): React.JSX.Element {
  const who = useIdentity()
  return (
    <>
      <div className="row" style={{ gap: 18, paddingBottom: 26 }}>
        <div
          style={{
            width: 64,
            height: 64,
            flexShrink: 0,
            borderRadius: '50%',
            background: 'var(--ink)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 500
          }}
        >
          {who.initial}
        </div>
        <div className="col" style={{ gap: 3, flex: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 500 }}>{who.name}</span>
          <span style={{ fontSize: 13.5, color: 'var(--ink2)', whiteSpace: 'nowrap' }}>
            Personal space · Free during the beta
          </span>
        </div>
      </div>
      <Row title="Name" sub="Shown in greetings and on shared plans and notes.">
        <NameField />
      </Row>
      <Row title="Email" sub="Used to sign in. Changing it is not available yet.">
        <Sel w={320} chevron={false}>
          {who.email || '—'}
        </Sel>
      </Row>
      <Row title="Time zone" sub="Used for your calendar and daily plan." end>
        <Sel w={320} chevron={false}>
          {timeZoneName()}
        </Sel>
      </Row>
    </>
  )
}

function Preferences(): React.JSX.Element {
  const prefs = useUI((s) => s.prefs)
  const set = useUI((s) => s.setPrefs)
  const [login, setLogin] = useState<{ supported: boolean; on: boolean } | null>(null)
  useEffect(() => {
    void window.api?.login.get().then(setLogin)
  }, [])
  return (
    <>
      <Head title="Preferences" sub="How Nexday looks and behaves for you." />
      <Row title="Language" sub="More languages are coming.">
        <Cyc
          value="English"
          options={['English']}
          onChange={(language) => set({ language: language as typeof prefs.language })}
        />
      </Row>
      <Row title="Time zone" sub="Taken from your Mac. Calendar events and your plan follow it.">
        <Sel>{timeZoneName()}</Sel>
      </Row>
      <Row title="Time format" sub="Shown across the day strip and tasks.">
        <Seg
          items={['24-hour', '12-hour']}
          value={prefs.timeFormat === '24-hour' ? 0 : 1}
          onChange={(i) => set({ timeFormat: i === 0 ? '24-hour' : '12-hour' })}
        />
      </Row>
      <Row title="Date format" sub="Day first, month first or year first.">
        <Cyc
          value={prefs.dateFormat}
          options={['17 Nov 2026', 'Nov 17, 2026', '2026-11-17']}
          onChange={(dateFormat) => set({ dateFormat: dateFormat as typeof prefs.dateFormat })}
        />
      </Row>
      <Row title="Start page" sub="What opens when you launch Nexday.">
        <Cyc
          value={prefs.startPage}
          options={['Today', 'Calendar', 'Inbox']}
          onChange={(startPage) => set({ startPage: startPage as typeof prefs.startPage })}
        />
      </Row>
      {login?.supported && (
        <Row title="Open at login" sub="Start Nexday when you sign in to your Mac. Applies to this Mac only.">
          <Sp />
          <Tg
            on={login.on}
            onChange={(on) => {
              setLogin({ ...login, on })
              void window.api?.login.set(on).then((v) => setLogin({ supported: true, on: v }))
            }}
          />
        </Row>
      )}
      <Row title="Density" sub="Row height in lists and the plan.">
        <Seg
          items={['Comfortable', 'Compact']}
          value={prefs.density === 'Comfortable' ? 0 : 1}
          onChange={(i) => set({ density: i === 0 ? 'Comfortable' : 'Compact' })}
        />
      </Row>
      <Row title="Sounds" sub="Play the system sound with desktop notifications.">
        <Sp />
        <Tg on={prefs.sounds} onChange={(sounds) => set({ sounds })} />
      </Row>
      <Row title="Reduce motion" sub="Turn off animations and transitions across the app.">
        <Sp />
        <Tg on={prefs.reduceMotion} onChange={(reduceMotion) => set({ reduceMotion })} />
      </Row>
      <Row
        title="Show completed tasks"
        sub="Keep finished tasks in the Today plan for the rest of the day."
        end
      >
        <Sp />
        <Tg on={prefs.showCompleted} onChange={(showCompleted) => set({ showCompleted })} />
      </Row>
    </>
  )
}

const nextTime = (t: string, step: number): string => {
  const [h, m] = t.split(':').map(Number)
  const n = (h * 60 + m + step) % (24 * 60)
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
}

function TimeSel({
  value,
  onChange,
  w = 120
}: {
  value: string
  onChange: (v: string) => void
  w?: number
}): React.JSX.Element {
  return (
    <span
      className="st-sel"
      style={{ minWidth: w, cursor: 'pointer' }}
      onClick={() => onChange(nextTime(value, 30))}
      title="Click to move 30 minutes"
    >
      <span className="mono">{value}</span>
    </span>
  )
}

function Planning(): React.JSX.Element {
  const plan = useUI((s) => s.planning)
  const set = useUI((s) => s.setPlanning)
  const lengths = [15, 30, 45, 60]
  const buffers = [0, 5, 10, 15]
  return (
    <>
      <Head title="Planning" sub="The rules Nexday follows when it builds your day." />
      <Row title="Work days" sub="Tasks are only scheduled on these days.">
        <div className="row" style={{ gap: 8 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span
              key={i}
              className={cn('st-day', plan.workDays[i] && 'on')}
              onClick={() => set({ workDays: plan.workDays.map((v, n) => (n === i ? !v : v)) })}
            >
              {d}
            </span>
          ))}
        </div>
      </Row>
      <Row title="Lunch break" sub="Kept free every work day.">
        <TimeSel value={plan.lunchStart} onChange={(lunchStart) => set({ lunchStart })} />
        <span style={{ color: 'var(--ink2)' }}>to</span>
        <TimeSel value={plan.lunchEnd} onChange={(lunchEnd) => set({ lunchEnd })} />
      </Row>
      <Row title="Default task length" sub="Used when a task has no estimate.">
        <Seg
          items={['15m', '30m', '45m', '1h']}
          value={Math.max(0, lengths.indexOf(plan.defaultLength))}
          onChange={(i) => set({ defaultLength: lengths[i] })}
        />
      </Row>
      <Row title="Buffer between events" sub="Breathing room Nexday leaves around meetings.">
        <Seg
          items={['None', '5m', '10m', '15m']}
          value={Math.max(0, buffers.indexOf(plan.buffer))}
          onChange={(i) => set({ buffer: buffers[i] })}
        />
      </Row>
      <Row title="Deep focus per day" sub="Nexday stops adding deep work after this.">
        <span
          className="st-sel"
          style={{ minWidth: 180, cursor: 'pointer' }}
          onClick={() => set({ deepFocusHours: (plan.deepFocusHours % 8) + 1 })}
          title="Click to change"
        >
          {plan.deepFocusHours} hour{plan.deepFocusHours === 1 ? '' : 's'}
        </span>
      </Row>
      <div className="st-h2">Automation</div>
      <Row title="Use my energy curve" sub="Place hard tasks when your energy is highest.">
        <Sp />
        <Tg on={plan.useEnergy} onChange={(useEnergy) => set({ useEnergy })} />
      </Row>
      <Row
        title="Move unfinished tasks"
        sub="Carry them to tomorrow at 18:00 instead of leaving them overdue."
      >
        <Sp />
        <Tg on={plan.moveUnfinished} onChange={(moveUnfinished) => set({ moveUnfinished })} />
      </Row>
      <Row title="Reserve time for habits" sub="Block calendar slots for your habits first.">
        <Sp />
        <Tg on={plan.reserveHabits} onChange={(reserveHabits) => set({ reserveHabits })} />
      </Row>
      <Row
        title="Ask before changing the plan"
        sub="Show a suggestion instead of moving things on its own."
        end
      >
        <Sp />
        <Tg on={plan.askFirst} onChange={(askFirst) => set({ askFirst })} />
      </Row>
    </>
  )
}

function Calendars(): React.JSX.Element {
  const mac = useCalendar()
  const calPrefs = useUI((s) => s.calPrefs)
  const setCal = useUI((s) => s.setCalPrefs)
  const macOn = mac.status === 'authorized'
  const macSub =
    mac.status === 'unavailable' || mac.status === 'unknown'
      ? 'Available in the Mac app'
      : macOn
        ? `${mac.calendars.length} calendars${mac.lastSync ? ' · Synced just now' : ''}`
        : mac.status === 'denied' || mac.status === 'restricted'
          ? 'Access is off. Allow Nexday in System Settings › Privacy & Security › Calendars.'
          : 'Not connected'
  const cal = (
    color: string,
    name: string,
    n: string,
    end?: boolean
  ): React.JSX.Element => (
    <div key={name} className={cn('st-cal', end && 'end')}>
      <span className="st-sw" style={{ background: color }} />
      <span>{name}</span>
      <Sp />
      <span style={{ fontSize: 13, color: 'var(--ink3)' }}>{n}</span>
      <Tg
        on={!calPrefs.hiddenCalendars.includes(name)}
        onChange={(show) => {
          const hidden = calPrefs.hiddenCalendars.filter((x) => x !== name)
          setCal({ hiddenCalendars: show ? hidden : [...hidden, name] })
          void useCalendar.getState().refresh()
        }}
      />
    </div>
  )
  return (
    <>
      <Head
        title="Calendars & sync"
        sub="Connect your calendars so Nexday plans around real events."
      />
      <div className="st-acc">
        <span className="st-dot" style={macOn ? undefined : { background: '#D6D6D3' }} />
        <div className="col" style={{ gap: 3, flex: 1 }}>
          <span style={{ fontWeight: 500 }}>Apple Calendar</span>
          <span style={{ fontSize: 13, color: 'var(--ink3)' }}>{macSub}</span>
        </div>
        {macOn ? (
          <span className="st-btn" onClick={() => void mac.refresh()}>
            {mac.busy ? 'Syncing…' : 'Sync now'}
          </span>
        ) : (
          mac.status !== 'unavailable' &&
          mac.status !== 'unknown' && (
            <span className="st-btn" onClick={() => void mac.connect()}>
              {mac.busy ? 'Waiting…' : 'Connect'}
            </span>
          )
        )}
      </div>
      <div className="st-h2">Calendars shown in Nexday</div>
      {macOn && mac.calendars.length > 0
        ? mac.calendars.map((c, i) =>
            cal(
              c.color,
              c.title,
              `${mac.events.filter((e) => e.sub?.includes(c.title)).length} events this week`,
              i === mac.calendars.length - 1
            )
          )
        : (
            <div className="st-cal end" style={{ color: 'var(--ink3)', fontSize: 13 }}>
              {macOn
                ? 'No calendars found in Mac Calendar.'
                : 'Connect Apple Calendar to choose which calendars appear. Google accounts added to the Mac show up there too.'}
            </div>
          )}
      <div className="st-h2">Sync rules</div>
      <Row title="Sync direction" sub="Choose where changes are written.">
        <Seg
          items={['Two-way', 'Calendar to Nexday']}
          value={calPrefs.syncDirection === 'Two-way' ? 0 : 1}
          onChange={(i) => setCal({ syncDirection: i === 0 ? 'Two-way' : 'Calendar to Nexday' })}
        />
      </Row>
      <Row title="New events go to" sub="The default calendar for events you create.">
        <Cyc
          value={calPrefs.newEventCalendar}
          options={['Personal', 'Work', 'Planner MVP']}
          onChange={(v) => setCal({ newEventCalendar: v as typeof calPrefs.newEventCalendar })}
          w={220}
        />
      </Row>
      <Row title="Show declined events" sub="Keep events you declined on your calendar." end>
        <Sp />
        <Tg
          on={calPrefs.showDeclined}
          onChange={(showDeclined) => {
            setCal({ showDeclined })
            void useCalendar.getState().refresh()
          }}
        />
      </Row>
    </>
  )
}

function Integrations({ go }: { go: (t: Tab) => void }): React.JSX.Element {
  const mac = useCalendar()
  const it = (
    ic: ReactNode,
    name: string,
    sub: string,
    action: ReactNode,
    connected: boolean,
    end?: boolean
  ): React.JSX.Element => (
    <div className={cn('st-it', end && 'end')}>
      <div
        className="ic"
        style={typeof ic === 'string' && ic === 'G' ? { color: '#4A78D4' } : undefined}
      >
        {ic}
      </div>
      <div className="t">
        <b>{name}</b>
        <i>{sub}</i>
      </div>
      {connected && (
        <span className="st-ok">
          <s />
          Connected
        </span>
      )}
      {action}
    </div>
  )
  const soon = <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Soon</span>
  const btn = (label: string, on?: () => void): React.JSX.Element => (
    <button className="st-btn s32" onClick={on}>
      {label}
    </button>
  )
  return (
    <>
      <Head
        title="Integrations"
        sub="Bring tasks, mentions and events into Nexday from the tools you already use."
        pb={18}
      />
      <div className="st-h2" style={{ paddingTop: 6, paddingBottom: 8 }}>
        Calendar
      </div>
      {it(
        '',
        'Apple Calendar',
        'Includes Google and Outlook accounts added to your Mac',
        btn('Open', () => go('calendars')),
        mac.status === 'authorized',
        true
      )}
      <div className="st-h2" style={{ paddingBottom: 8 }}>
        Coming soon
      </div>
      {it('G', 'Gmail', 'Turn starred emails into Inbox items', soon, false)}
      {it('#', 'Slack', 'Mentions and direct messages', soon, false)}
      {it(
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.8">
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="6" cy="18" r="2.5" />
          <circle cx="18" cy="8" r="2.5" />
          <path d="M6 8.5v7M18 10.5c0 4-6 3-12 5" />
        </svg>,
        'GitHub',
        'Review requests',
        soon,
        false
      )}
      {it('N', 'Notion', 'Link notes and turn database rows into tasks', soon, false)}
      {it('L', 'Linear', 'Pull assigned issues into your Inbox', soon, false)}
      {it(
        'T',
        'Todoist',
        'Import existing tasks and keep them in sync',
        soon,
        false,
        true
      )}
    </>
  )
}

function Notifications(): React.JSX.Element {
  const rows: Array<[string, string, [boolean, boolean, boolean]]> = [
    ['Daily plan', 'Every work day at 08:30', [true, false, true]],
    ['Up next', 'Before meetings and planned tasks', [true, false, true]],
    ['Inbox suggestions', 'Coming soon', [false, false, true]],
    ['Tasks due today', 'A nudge at 16:00 for open tasks', [true, false, true]],
    ['Habit reminders', 'At the time of each habit slot', [true, false, false]],
    ['Weekly review', 'Friday at 17:00', [false, true, false]],
    ['Shared notes and mentions', 'Coming soon', [true, true, true]]
  ]
  const prefs = useUI((s) => s.notifPrefs)
  const set = useUI((s) => s.setNotifPrefs)
  const flip = (r: number, c: number): void =>
    set({
      matrix: prefs.matrix.map((row, i) => (i === r ? row.map((v, j) => (j === c ? !v : v)) : row))
    })
  return (
    <>
      <Head title="Notifications" sub="Choose what Nexday tells you, and where." />
      <Row title="Quiet hours" sub="No desktop notifications during this window.">
        <TimeSel value={prefs.quietStart} onChange={(quietStart) => set({ quietStart })} w={110} />
        <span style={{ color: 'var(--ink2)' }}>to</span>
        <TimeSel value={prefs.quietEnd} onChange={(quietEnd) => set({ quietEnd })} w={110} />
        <Sp />
        <Tg on={prefs.quietOn} onChange={(quietOn) => set({ quietOn })} />
      </Row>
      <Row title="Remind me before events" sub="Applies to the Up next reminder.">
        <Cyc
          value={prefs.remind}
          options={['5 minutes before', '10 minutes before', '30 minutes before']}
          onChange={(remind) => set({ remind: remind as typeof prefs.remind })}
          w={180}
        />
      </Row>
      <div className="row" style={{ padding: '30px 0 10px' }}>
        <span className="st-sp" style={{ fontSize: 12.5, color: 'var(--ink3)' }}>
          What to notify
        </span>
        {['Desktop', 'Email (soon)', 'In app (soon)'].map((h) => (
          <span key={h} className="st-c" style={{ fontSize: 12.5, color: 'var(--ink3)' }}>
            {h}
          </span>
        ))}
      </div>
      {rows.map(([t, s], r) => (
        <div className={cn('st-nr', r === rows.length - 1 && 'end')} key={t}>
          <div className="t">
            <b>{t}</b>
            <span>{s}</span>
          </div>
          {prefs.matrix[r].map((on, c) => (
            <div className="st-c" key={c}>
              <span className={cn('st-ck', on && 'on')} onClick={() => flip(r, c)}>
                {on && tick(11, '#fff', 3.5)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

function Shortcuts(): React.JSX.Element {
  const prefs = useUI((s) => s.prefs)
  const setPrefs = useUI((s) => s.setPrefs)
  const map = resolveShortcuts(prefs)
  const [editing, setEditing] = useState<ShortcutId | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setEditing(null)
        setProblem(null)
        return
      }
      const combo = comboOf(e)
      if (!combo) {
        if (!['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) setProblem('Hold ⌘ or Ctrl together with a key.')
        return
      }
      const bad = problemWith(combo, editing, map)
      if (bad) return setProblem(bad)
      const def = SHORTCUTS.find((x) => x.id === editing)!.def
      const next = { ...prefs.shortcuts }
      if (combo === def) delete next[editing]
      else next[editing] = combo
      setPrefs({ shortcuts: next })
      setEditing(null)
      setProblem(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const q = query.trim().toLowerCase()
  const shown = (g: 'General' | 'Create'): typeof SHORTCUTS =>
    SHORTCUTS.filter((x) => x.group === g && (!q || x.label.toLowerCase().includes(q)))
  const grp = (title: string, items: typeof SHORTCUTS): React.JSX.Element | null =>
    items.length === 0 ? null : (
      <div className="st-grp">
        <div className="st-gh">{title}</div>
        {items.map((x) => (
          <div className="st-sc" key={x.id}>
            <span>{x.label}</span>
            <Sp />
            {editing === x.id ? (
              <span className="st-kbd l" style={{ color: 'var(--accent, #F38020)' }}>
                {problem ?? 'Press the new keys… (Esc to cancel)'}
              </span>
            ) : (
              <button
                className="row"
                style={{ gap: 6 }}
                title="Click to change"
                onClick={() => {
                  setEditing(x.id)
                  setProblem(null)
                }}
              >
                {keycaps(map[x.id]).map((k, i) => (
                  <span key={i} className="st-kbd l">
                    {k}
                  </span>
                ))}
              </button>
            )}
          </div>
        ))}
      </div>
    )
  const goTo = GO_TO.filter((g) => !q || g.label.toLowerCase().includes(q) || 'go to'.includes(q))
  const changed = Object.keys(prefs.shortcuts).length > 0
  return (
    <>
      <div className="row" style={{ gap: 16, paddingBottom: 22 }}>
        <div className="col" style={{ gap: 3, flex: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 500 }}>Keyboard shortcuts</span>
          <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>Click any shortcut to change it.</span>
        </div>
        <label
          className="row"
          style={{ gap: 8, height: 36, width: 220, border: '1px solid var(--line2)', borderRadius: 10, padding: '0 12px' }}
        >
          <Icon name="search" size={14} strokeWidth={1.8} round />
          <input
            placeholder="Find a shortcut"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 13.5, flex: 1, minWidth: 0 }}
          />
        </label>
        {changed && (
          <button className="st-btn" onClick={() => setPrefs({ shortcuts: {} })}>
            Reset to defaults
          </button>
        )}
      </div>
      <div className="st-srow" style={{ padding: '16px 0' }}>
        <div className="st-l" style={{ width: 'auto', flex: 1 }}>
          <b>Single-key shortcuts</b>
          <span>Press G then I to jump to Inbox, without holding ⌘. Not active while you type.</span>
        </div>
        <Tg on={prefs.singleKey} onChange={(singleKey) => setPrefs({ singleKey })} />
      </div>
      <div className="row" style={{ gap: 56, alignItems: 'flex-start', paddingTop: 22, borderTop: '1px solid var(--line)' }}>
        <div className="col" style={{ flex: 1 }}>
          {grp('General', shown('General'))}
          {(!q || 'close or go back'.includes(q)) && (
            <div className="st-grp">
              <div className="st-sc">
                <span>Close or go back</span>
                <Sp />
                <span className="st-kbd l">esc</span>
              </div>
            </div>
          )}
        </div>
        <div className="col" style={{ flex: 1 }}>
          {grp('Create', shown('Create'))}
          {goTo.length > 0 && (
            <div className="st-grp">
              <div className="st-gh">Go to</div>
              {goTo.map((g) => (
                <div className="st-sc" key={g.key} style={prefs.singleKey ? undefined : { opacity: 0.45 }}>
                  <span>{g.label}</span>
                  <Sp />
                  <span className="st-kbd l">G</span>
                  <span className="a" style={{ color: 'var(--ink3)', fontSize: 12.5, margin: '0 2px' }}>
                    then
                  </span>
                  <span className="st-kbd l">{g.key}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Data(): React.JSX.Element {
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null)
  const [imp, setImp] = useState<ParsedImport | null>(null)

  const runExport = async (kind: 'json' | 'csv'): Promise<void> => {
    setBusy(true)
    setNote(null)
    const file = await (kind === 'json' ? buildJsonExport() : buildTasksCsv())
    if ('error' in file) setNote({ text: file.error, bad: true })
    else {
      const r = await saveExport(file)
      if (r.saved) setNote({ text: r.where ? `Saved to ${r.where}` : 'Downloaded.' })
    }
    setBusy(false)
  }

  const chooseFile = async (): Promise<void> => {
    setNote(null)
    let name = ''
    let text = ''
    if (window.api?.files) {
      const r = await window.api.files.open()
      if (!r) return
      if ('error' in r) {
        setNote({ text: 'That file is larger than 10 MB.', bad: true })
        return
      }
      name = r.name
      text = r.text
    } else {
      const f = await new Promise<File | null>((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,.csv'
        input.onchange = () => resolve(input.files?.[0] ?? null)
        input.click()
      })
      if (!f) return
      name = f.name
      text = await f.text()
    }
    const parsed = parseImport(name, text)
    if ('error' in parsed) setNote({ text: parsed.error, bad: true })
    else setImp(parsed)
  }
  const it = (
    title: string,
    sub: string,
    action: ReactNode,
    end?: boolean,
    danger?: boolean
  ): React.JSX.Element => (
    <div className={cn('st-it', end && 'end')} style={{ gap: 16 }}>
      <div className="t">
        <b style={danger ? { color: '#C2362B' } : undefined}>{title}</b>
        <i>{sub}</i>
      </div>
      {action}
    </div>
  )
  return (
    <>
      <Head
        title="Data & privacy"
        sub="Your tasks, notes and events belong to you. Take them with you any time."
        pb={18}
      />
      <div className="st-h2" style={{ paddingTop: 6, paddingBottom: 8 }}>
        Your data
      </div>
      {it(
        'Export everything',
        'All your tasks, notes, events, habits and projects as one JSON file, or just the tasks as CSV.',
        <div className="row" style={{ gap: 8 }}>
          <button className="st-btn s34" disabled={busy} onClick={() => void runExport('json')}>
            {busy ? 'Preparing…' : 'Export JSON'}
          </button>
          <button className="st-btn s34" disabled={busy} onClick={() => void runExport('csv')}>
            Tasks CSV
          </button>
        </div>
      )}
      {it(
        'Import tasks',
        'A Nexday export, Google Tasks (Takeout) or a CSV from Todoist, Notion and others. Open tasks only.',
        <button className="st-btn s34" onClick={() => void chooseFile()}>
          Choose file
        </button>,
        true
      )}
      {note && (
        <div style={{ padding: '8px 0 0', fontSize: 13, color: note.bad ? '#C2362B' : '#6B6B6B' }}>
          {note.text}
        </div>
      )}
      {imp && <ImportDialog parsed={imp} onClose={() => setImp(null)} />}
      <div className="st-h2" style={{ paddingTop: 28, paddingBottom: 8 }}>
        Privacy
      </div>
      {it(
        'Learn from my calendar and tasks',
        'Nexday uses your patterns to suggest better times. Nothing leaves your account.',
        <Tg2 />
      )}
      {it(
        'Index note content for search',
        'Lets you find words inside notes from the command palette.',
        <Tg2 />
      )}
      {it(
        'Share anonymous usage data',
        'Helps us fix bugs and improve Nexday. No task or note text is included.',
        <Tg2 init={false} />,
        true
      )}
      <div className="st-h2" style={{ paddingTop: 28, paddingBottom: 8 }}>
        Account
      </div>
      {it(
        'Clear Nexday suggestions history',
        'Resets what Nexday has learned. Your tasks and notes stay.',
        <button className="st-btn s34">Clear history</button>
      )}
      {it(
        'Delete account',
        "Permanently removes your account and all data. This can't be undone.",
        <button
          className="st-btn s34"
          style={{ color: '#C2362B', borderColor: '#EBC5C1' }}
          onClick={() => setDeleting(true)}
        >
          Delete account
        </button>,
        true,
        true
      )}
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </>
  )
}

/* ---------- shell ---------- */

export default function Settings(): React.JSX.Element {
  const { tab = 'profile' } = useParams()
  const navigate = useNavigate()
  const current = (tabs.find((t) => t[0] === tab)?.[0] ?? 'profile') as Tab
  const back = (): void => void navigate('/today')
  const go = (t: Tab): void => void navigate(`/settings/${t}`)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="drag-strip" />
      <div className="st">
        <div className="st-card">
          <div className="row" style={{ height: 36, gap: 12, paddingLeft: 24, flex: 'none' }}>
            <span className="st-btn" style={{ padding: '0 16px 0 12px' }} onClick={back}>
              <Icon name="chevronLeft" size={15} strokeWidth={1.8} />
              Back to Nexday
            </span>
            <span className="st-kbd">esc</span>
            <Sp />
            <span
              className="st-btn"
              onClick={() => {
                useAuth.getState().signOut()
                void navigate('/login')
              }}
            >
              Sign out
            </span>
          </div>
          <div className="st-in">
            <div className="col" style={{ marginTop: 44, gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Account · Personal space</span>
              <span style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.1 }}>Settings</span>
            </div>
            <div className="row" style={{ marginTop: 34, alignItems: 'flex-start', gap: 56 }}>
              <div className="col" style={{ width: 200, gap: 2, flex: 'none' }}>
                {tabs.map(([id, label]) => (
                  <div
                    key={id}
                    className={cn('st-sn', id === current && 'on')}
                    onClick={() => go(id)}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="col st-page" key={current} style={{ flex: 1, minWidth: 0 }}>
                {current === 'profile' && <Profile />}
                {current === 'preferences' && <Preferences />}
                {current === 'planning' && <Planning />}
                {current === 'calendars' && <Calendars />}
                {current === 'integrations' && <Integrations go={go} />}
                {current === 'notifications' && <Notifications />}
                {current === 'shortcuts' && <Shortcuts />}
                {current === 'data' && <Data />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
