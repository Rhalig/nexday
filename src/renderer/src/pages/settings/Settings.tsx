import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { DeleteAccountDialog, Modal } from '../../components/Dialogs'
import { cn } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { useIdentity, timeZoneName } from '../../lib/identity'
import { useCalendar } from '../../store/calendar'
import { useUI } from '../../store/ui'
import { useNotes } from '../../store/notes'
import { useProjects } from '../../store/projects'
import { usePlan } from '../../lib/plan'
import { startCheckout } from '../../lib/billing'
import './settings.css'

const tabs = [
  ['profile', 'Profile'],
  ['preferences', 'Preferences'],
  ['planning', 'Planning'],
  ['calendars', 'Calendars & sync'],
  ['integrations', 'Integrations'],
  ['notifications', 'Notifications'],
  ['shortcuts', 'Shortcuts'],
  ['data', 'Data & privacy'],
  ['billing', 'Plan & billing']
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

function Profile(): React.JSX.Element {
  const who = useIdentity()
  const planId = usePlan((st) => st.id)
  return (
    <>
      <div className="row" style={{ gap: 18, paddingBottom: 26 }}>
        <div
          style={{
            width: 64,
            height: 64,
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
          <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>
            Personal space · {planId === 'pro' ? 'Pro' : 'Free'} plan
          </span>
        </div>
      </div>
      <Row title="Name" sub="Shown on shared plans and notes.">
        <Sel w={320} chevron={false}>
          {who.name}
        </Sel>
      </Row>
      <Row title="Email" sub="Used to sign in and for daily digests.">
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
  return (
    <>
      <Head title="Preferences" sub="How Nexday looks and behaves for you." />
      <Row title="Language" sub="Used for menus and AI suggestions.">
        <Cyc
          value={prefs.language}
          options={['English', 'Türkçe']}
          onChange={(language) => set({ language: language as typeof prefs.language })}
        />
      </Row>
      <Row title="Time zone" sub="Calendar events and your plan follow this.">
        <Sel>Europe/Istanbul · GMT+3</Sel>
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
      <Row title="Density" sub="Row height in lists and the plan.">
        <Seg
          items={['Comfortable', 'Compact']}
          value={prefs.density === 'Comfortable' ? 0 : 1}
          onChange={(i) => set({ density: i === 0 ? 'Comfortable' : 'Compact' })}
        />
      </Row>
      <Row title="Sounds" sub="A soft tone when you complete a task.">
        <Sp />
        <Tg on={prefs.sounds} onChange={(sounds) => set({ sounds })} />
      </Row>
      <Row title="Reduce motion" sub="Turn off animations in the day strip and lists.">
        <Sp />
        <Tg on={prefs.reduceMotion} onChange={(reduceMotion) => set({ reduceMotion })} />
      </Row>
      <Row
        title="Show completed tasks"
        sub="Keep finished tasks visible for the rest of the day."
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
  const acc = (
    name: string,
    sub: string,
    on: boolean,
    btns: string[],
    end?: boolean
  ): React.JSX.Element => (
    <div className={cn('st-acc', end && 'end')}>
      <span className="st-dot" style={on ? undefined : { background: '#D6D6D3' }} />
      <div className="col" style={{ gap: 3, flex: 1 }}>
        <span style={{ fontWeight: 500 }}>{name}</span>
        <span style={{ fontSize: 13, color: 'var(--ink3)' }}>{sub}</span>
      </div>
      {btns.map((b) => (
        <span className="st-btn" key={b}>
          {b}
        </span>
      ))}
    </div>
  )
  const cal = (
    color: string,
    name: string,
    n: string,
    on: boolean,
    end?: boolean
  ): React.JSX.Element => (
    <div key={name} className={cn('st-cal', end && 'end')}>
      <span className="st-sw" style={{ background: color }} />
      <span>{name}</span>
      <Sp />
      <span style={{ fontSize: 13, color: 'var(--ink3)' }}>{n}</span>
      <Tg init={on} />
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
      {acc('Outlook', 'Not connected', false, ['Connect'], true)}
      <div className="st-h2">Calendars shown in Nexday</div>
      {macOn && mac.calendars.length > 0
        ? mac.calendars.map((c, i) =>
            cal(
              c.color,
              c.title,
              `${mac.events.filter((e) => e.sub?.includes(c.title)).length} events this week`,
              true,
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
      <Row title="Show declined events" sub="Keep them in the day strip as faded blocks." end>
        <Sp />
        <Tg on={calPrefs.showDeclined} onChange={(showDeclined) => setCal({ showDeclined })} />
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
    ['Inbox suggestions', 'When Nexday finds something to triage', [false, false, true]],
    ['Tasks due today', 'A nudge at 16:00 for open tasks', [true, false, true]],
    ['Habit reminders', 'At the time of each habit slot', [true, false, false]],
    ['Weekly review', 'Friday at 17:00', [false, true, false]],
    ['Shared notes and mentions', 'When someone edits or mentions you', [true, true, true]]
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
      <Row title="Quiet hours" sub="No push notifications during this window.">
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
        {['Push', 'Email', 'In app'].map((h) => (
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
  const keys = (ks: string[], then?: boolean): ReactNode =>
    ks.map((k, i) => (
      <span key={i} className="row" style={{ gap: 6 }}>
        {then && i === 1 && (
          <span className="a" style={{ color: 'var(--ink3)', fontSize: 12.5, margin: '0 2px' }}>
            then
          </span>
        )}
        <span className="st-kbd l">{k}</span>
      </span>
    ))
  const grp = (title: string, items: Array<[string, string[], boolean?]>): React.JSX.Element => (
    <div className="st-grp">
      <div className="st-gh">{title}</div>
      {items.map(([n, k, then]) => (
        <div className="st-sc" key={n}>
          <span>{n}</span>
          <Sp />
          {keys(k, then)}
        </div>
      ))}
    </div>
  )
  return (
    <>
      <div className="row" style={{ gap: 16, paddingBottom: 22 }}>
        <div className="col" style={{ gap: 3, flex: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 500 }}>Keyboard shortcuts</span>
          <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>
            Click any shortcut to change it.
          </span>
        </div>
        <div
          className="row"
          style={{
            gap: 8,
            height: 36,
            width: 220,
            border: '1px solid var(--line2)',
            borderRadius: 10,
            padding: '0 12px'
          }}
        >
          <Icon name="search" size={14} strokeWidth={1.8} round />
          <span style={{ fontSize: 13.5, color: 'var(--ink3)' }}>Find a shortcut</span>
        </div>
        <span className="st-btn">Reset to defaults</span>
      </div>
      <div className="st-srow" style={{ padding: '16px 0' }}>
        <div className="st-l" style={{ width: 'auto', flex: 1 }}>
          <b>Single-key shortcuts</b>
          <span>Press G then I to jump to Inbox, or T to add a task, without holding ⌘.</span>
        </div>
        <Tg init />
      </div>
      <div
        className="row"
        style={{
          gap: 56,
          alignItems: 'flex-start',
          paddingTop: 22,
          borderTop: '1px solid var(--line)'
        }}
      >
        <div className="col" style={{ flex: 1 }}>
          {grp('General', [
            ['Search or command', ['⌘', 'K']],
            ['Open settings', ['⌘', ',']],
            ['Show all shortcuts', ['⌘', '/']],
            ['Close or go back', ['esc']]
          ])}
          {grp('Go to', [
            ['Today', ['G', 'T'], true],
            ['Inbox', ['G', 'I'], true],
            ['Calendar', ['G', 'C'], true],
            ['Tasks', ['G', 'K'], true],
            ['Notes', ['G', 'N'], true],
            ['Habits', ['G', 'H'], true]
          ])}
        </div>
        <div className="col" style={{ flex: 1 }}>
          {grp('Create', [
            ['New task', ['⌘', 'T']],
            ['New event', ['⌘', 'E']],
            ['New note', ['⌘', 'N']],
            ['New project', ['⌘', '⇧', 'P']]
          ])}
          {grp('Plan and tasks', [
            ['Add to plan', ['⌘', '↵']],
            ['Auto-schedule', ['⌘', '⇧', 'A']],
            ['Complete task', ['⌘', 'D']],
            ['Move to tomorrow', ['⌘', ']']],
            ['Snooze', ['S']],
            ['Focus the quick-capture bar', ['/']]
          ])}
        </div>
      </div>
    </>
  )
}

function Data(): React.JSX.Element {
  const [deleting, setDeleting] = useState(false)
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
        'Tasks, notes, events and habits as JSON or CSV. Ready in about a minute.',
        <button className="st-btn s34">Request export</button>
      )}
      {it(
        'Import from another app',
        'Todoist, Notion, Google Tasks or a CSV file.',
        <button className="st-btn s34">Choose file</button>,
        true
      )}
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

function Billing({ compare }: { compare: () => void }): React.JSX.Element {
  const plan = usePlan()
  const notesCount = useNotes((s) => s.notes.length)
  const projectsCount = useProjects((s) => s.custom.length)
  const [upBusy, setUpBusy] = useState(false)
  const [upErr, setUpErr] = useState<string | null>(null)
  const pro = plan.id === 'pro'
  useEffect(() => {
    void usePlan.getState().load()
  }, [])
  const pct = (used: number, limit?: number | null): number =>
    typeof limit === 'number' && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const of = (used: number, limit?: number | null): string => `${used} of ${limit ?? '∞'}`
  const upgrade = async (): Promise<void> => {
    setUpErr(null)
    setUpBusy(true)
    const r = await startCheckout()
    setUpBusy(false)
    if (r.error) setUpErr(r.error)
  }
  const feats = [
    'Unlimited projects and notes',
    'Up to 5 connected calendars',
    'Weekly auto-schedule',
    'Meeting notes with action items',
    'Priority support'
  ]
  const us = (n: string, pct: number, v: string, end?: boolean): React.JSX.Element => (
    <div className={cn('st-us', end && 'end')} key={n}>
      <span className="n">{n}</span>
      <div className="st-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="v">{v}</span>
    </div>
  )
  return (
    <>
      <Head
        title="Plan & billing"
        sub={pro ? 'You are on Nexday Pro. Thank you.' : 'You are on the Free plan.'}
        pb={24}
      />
      <div
        className="row"
        style={{
          gap: 56,
          alignItems: 'flex-start',
          padding: '24px 0',
          borderTop: '1px solid var(--line)'
        }}
      >
        <div className="col" style={{ flex: 1, gap: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--ink3)' }}>Nexday Pro</span>
          <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
            <span style={{ fontSize: 32, fontWeight: 500 }}>$6</span>
            <span style={{ fontSize: 14, color: 'var(--ink2)' }}>per month</span>
          </div>
          <span
            style={{
              fontSize: 13.5,
              color: 'var(--ink2)',
              lineHeight: 1.5,
              marginTop: 6,
              maxWidth: 300
            }}
          >
            Unlimited projects and calendars, and Nexday can plan your whole week.
          </span>
          <div className="row" style={{ gap: 10, marginTop: 18 }}>
            {pro ? (
              <span className="st-btn">You are on Pro</span>
            ) : (
              <span className="st-btn dark" onClick={() => void upgrade()}>
                {upBusy ? 'Opening checkout…' : 'Upgrade to Pro'}
              </span>
            )}
            <span className="st-btn" onClick={compare}>
              Compare plans
            </span>
          </div>
          {upErr && (
            <span style={{ fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5, marginTop: 8 }}>
              {upErr}
            </span>
          )}
        </div>
        <div className="col" style={{ flex: 1 }}>
          {feats.map((f) => (
            <div className="st-f" key={f}>
              {tick(16, '#F38020', 2.4)}
              {f}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink3)', padding: '26px 0 8px' }}>
        Usage this month
      </div>
      {us(
        'Projects',
        pct(projectsCount, plan.limits.projects),
        of(projectsCount, plan.limits.projects)
      )}
      {us('Connected calendars', pct(1, plan.limits.calendars), of(1, plan.limits.calendars))}
      {us(
        'Nexday suggestions',
        pct(plan.aiUsed, plan.limits.ai_per_month),
        of(plan.aiUsed, plan.limits.ai_per_month)
      )}
      {us('Notes', pct(notesCount, plan.limits.notes), of(notesCount, plan.limits.notes), true)}
      <div style={{ fontSize: 12.5, color: 'var(--ink3)', padding: '26px 0 8px' }}>Billing</div>
      <div className="st-us">
        <span className="n">Payment method</span>
        <span style={{ fontSize: 13.5, color: 'var(--ink3)', flex: 1 }}>
          {pro ? 'Stripe' : 'None added'}
        </span>
        {!pro && <span className="st-btn">Add card</span>}
      </div>
      <div className="st-us end">
        <span className="n">Invoices</span>
        <span style={{ fontSize: 13.5, color: 'var(--ink3)', flex: 1 }}>No invoices yet</span>
      </div>
    </>
  )
}

function CompareDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [yearly, setYearly] = useState(false)
  const [busy, setBusy] = useState(false)
  const upgrade = async (): Promise<void> => {
    setBusy(true)
    const r = await startCheckout()
    setBusy(false)
    if (!r.error) onClose()
  }
  const rows: Array<[string, string, string | true]> = [
    ['Projects', 'Up to 5', 'Unlimited'],
    ['Notes', 'Up to 50', 'Unlimited'],
    ['Connected calendars', '1', 'Up to 5'],
    ['Nexday suggestions', '200 per month', 'Unlimited'],
    ['Weekly auto-schedule', '—', true],
    ['Meeting notes with action items', '—', true],
    ['Support', 'Community', 'Priority']
  ]
  const seg = (on: boolean): React.CSSProperties => ({
    height: 28,
    lineHeight: '28px',
    padding: '0 14px',
    borderRadius: 7,
    fontSize: 12.5,
    cursor: 'pointer',
    ...(on
      ? { background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.08)', fontWeight: 500 }
      : { color: '#6B6B6B' })
  })
  return (
    <Modal top={110} width={760} onClose={onClose} style={{ width: 760, lineHeight: 1.5 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col">
          <span style={{ fontSize: 20, fontWeight: 500 }}>Compare plans</span>
          <span style={{ fontSize: 13, color: '#6B6B6B' }}>
            Everything in Free stays free. Pro removes the limits and lets Nexday plan your week.
          </span>
        </div>
        <button className="dl-x" onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} strokeWidth={1.9} />
        </button>
      </div>
      <div className="row" style={{ marginTop: 20, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div
            className="row"
            style={{
              padding: 3,
              borderRadius: 10,
              background: '#F5F5F4',
              border: '1px solid #EDEDEB',
              width: 'fit-content'
            }}
          >
            <span style={seg(!yearly)} onClick={() => setYearly(false)}>
              Monthly
            </span>
            <span style={seg(yearly)} onClick={() => setYearly(true)}>
              Yearly · 2 months free
            </span>
          </div>
        </div>
        <div className="col" style={{ width: 160, lineHeight: 1.3 }}>
          <span style={{ fontSize: 13, color: '#6B6B6B' }}>Free</span>
          <span style={{ fontSize: 24, fontWeight: 500 }}>$0</span>
        </div>
        <div className="col" style={{ width: 160, lineHeight: 1.3 }}>
          <span style={{ fontSize: 13, color: '#B4500A' }}>Nexday Pro</span>
          <span style={{ fontSize: 24, fontWeight: 500 }}>
            {yearly ? '$5' : '$6'}{' '}
            <span style={{ fontSize: 13, fontWeight: 400, color: '#6B6B6B' }}>per month</span>
          </span>
        </div>
      </div>
      <div className="col" style={{ marginTop: 14, borderTop: '1px solid #EDEDEB' }}>
        {rows.map(([a, b, c]) => (
          <div
            key={a}
            className="row"
            style={{ minHeight: 46, borderBottom: '1px solid #EDEDEB', fontSize: 13.5 }}
          >
            <span style={{ flex: 1 }}>{a}</span>
            <span style={{ width: 160, color: '#6B6B6B' }}>{b}</span>
            <span style={{ width: 160, fontWeight: 500 }}>
              {c === true ? tick(16, '#F38020', 2.4) : c}
            </span>
          </div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="sn-k" style={{ padding: '1px 5px' }}>
            esc
          </span>
          <span style={{ fontSize: 12, color: '#6B6B6B' }}>Close</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={onClose}>
            Maybe later
          </button>
          <button className="btn dark" onClick={() => void upgrade()} disabled={busy}>
            {busy ? 'Opening checkout…' : `Upgrade to Pro · ${yearly ? '$5' : '$6'}/mo`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- shell ---------- */

export default function Settings(): React.JSX.Element {
  const { tab = 'profile' } = useParams()
  const navigate = useNavigate()
  const compare = tab === 'compare'
  const current = (compare ? 'billing' : (tabs.find((t) => t[0] === tab)?.[0] ?? 'profile')) as Tab
  const back = (): void => void navigate(compare ? '/settings/billing' : '/today')
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
                {current === 'billing' && (
                  <Billing compare={() => void navigate('/settings/compare')} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {compare && <CompareDialog onClose={() => void navigate('/settings/billing')} />}
    </>
  )
}
