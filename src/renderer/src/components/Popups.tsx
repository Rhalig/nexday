import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Icon, type IconName } from './Icon'
import { Overlay } from './Overlay'
import { Button, Kbd, cn } from './ui'
import { unreadCount, useNotifs, type Notif } from '../store/notifs'
import { useProjects } from '../store/projects'
import { useUI } from '../store/ui'
import './popups.css'
import { useIdentity } from '../lib/identity'
import { retryNow, useSync } from '../lib/cloud'
import { useCalendar } from '../store/calendar'

/** Closes on Escape (capture phase so it wins over a drawer underneath). */
export function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
}

function Catcher({ onClose }: { onClose: () => void }): React.JSX.Element {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onMouseDown={onClose} />
}

/* ---------------- Profile menu ---------------- */

export function ProfileMenu(): React.JSX.Element {
  const who = useIdentity()
  const { closePanel, openPanel, autoSchedule, pauseNotifs, toggle } = useUI()
  const navigate = useNavigate()
  useEscape(closePanel)
  const goSettings = (tab: string) => (): void => {
    closePanel()
    navigate(`/settings/${tab}`)
  }

  const item = (
    icon: IconName,
    label: string,
    hint?: string,
    onClick?: () => void
  ): React.JSX.Element => (
    <button className={cn('pm-item', label === 'Settings' && 'on')} onClick={onClick ?? closePanel}>
      <Icon name={icon} strokeWidth={1.6} round />
      {label}
      <span style={{ flex: 1 }} />
      {hint && <span className="pm-kbd">{hint}</span>}
    </button>
  )

  return (
    <>
      <Catcher onClose={closePanel} />
      <div className="pm">
        <div className="row" style={{ gap: 10, padding: '10px 16px 12px' }}>
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
            {who.initial}
          </div>
          <div className="col" style={{ flex: 1 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{who.name}</span>
            <span style={{ fontSize: 12, color: '#767676' }}>
              Personal space · Beta
            </span>
          </div>
        </div>
        <div className="pm-hr" style={{ marginTop: 0 }} />
        {item('gear', 'Settings', '⌘ ,', goSettings('profile'))}
        {item('keyboard', 'Shortcuts', '⌘ /', goSettings('shortcuts'))}
        <div className="pm-hr" />
        <div className="pm-lb">Quick settings</div>
        <button className="pm-item" onClick={() => toggle('autoSchedule')}>
          Auto-schedule
          <span style={{ flex: 1 }} />
          <span className={cn('pm-tg', autoSchedule && 'on')} />
        </button>
        <button className="pm-item" onClick={() => toggle('pauseNotifs')}>
          Pause notifications
          <span style={{ flex: 1 }} />
          <span className={cn('pm-tg', pauseNotifs && 'on')} />
        </button>
        <div className="pm-hr" />
        {item('helpCircle', 'Help & feedback', undefined, () => openPanel('help'))}
        {item('signOut', 'Sign out', undefined, () => {
          closePanel()
          useAuth.getState().signOut()
          navigate('/login')
        })}
      </div>
    </>
  )
}

/* ---------------- Sync popover ---------------- */

export function SyncPopover({
  anchor,
  onClose
}: {
  anchor: { right: number; bottom: number }
  onClose: () => void
}): React.JSX.Element {
  useEscape(onClose)
  const mac = useCalendar()
  const cloud = useSync()
  const ago = (t: number | null): string => {
    if (!t) return 'not yet'
    const m = Math.floor((Date.now() - t) / 60000)
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`
  }
  const macOn = mac.status === 'authorized'
  const accounts = [
    {
      letter: 'A',
      color: undefined,
      name: 'Apple Calendar',
      sub: macOn
        ? `${mac.calendars.length} ${mac.calendars.length === 1 ? 'calendar' : 'calendars'} (includes Google accounts added to the Mac)`
        : 'Not connected',
      when: macOn ? ago(mac.lastSync) : '—',
      ok: macOn
    },
    {
      letter: 'N',
      color: undefined,
      name: 'Nexday cloud',
      sub: cloud.state === 'error' ? 'Could not save your latest changes' : 'Your tasks, notes and events',
      when: ago(cloud.lastSync),
      ok: cloud.state !== 'error'
    }
  ]
  const log: Array<[string, string]> = []
  return (
    <>
      <Catcher onClose={onClose} />
      <div className="sp" style={{ left: anchor.right - 360, top: anchor.bottom + 9 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="col" style={{ lineHeight: 1.3 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Calendar sync</span>
            <span className="row" style={{ gap: 6, fontSize: 12.5, color: '#6B6B6B' }}>
              <span className="sp-dot" />
              {cloud.state === 'error' ? 'Needs attention' : cloud.state === 'saving' ? 'Saving…' : 'Up to date'}
            </span>
          </div>
          <Button
            onClick={() => {
              retryNow()
              void mac.refresh()
            }}
          >
            <Icon name="refresh" size={13} strokeWidth={2} />
            Sync now
          </Button>
        </div>
        <div className="col" style={{ marginTop: 12, borderTop: '1px solid #EDEDEB' }}>
          {accounts.map((a) => (
            <div className="sp-ac" key={a.name}>
              <div
                className="row"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid #E2E2E0',
                  justifyContent: 'center',
                  fontWeight: 500,
                  fontSize: 13,
                  color: a.color
                }}
              >
                {a.letter}
              </div>
              <div className="sp-t">
                <b>{a.name}</b>
                <i>{a.sub}</i>
              </div>
              <span className="row" style={{ gap: 6, fontSize: 12, color: '#6B6B6B' }}>
                <span className="sp-dot" style={a.ok ? undefined : { background: '#C2362B' }} />
                {a.when}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: '#6B6B6B',
            fontWeight: 500,
            padding: '14px 0 4px'
          }}
        >
          Latest changes
        </div>
        <div className="col" style={{ borderTop: '1px solid #EDEDEB' }}>
          {log.length === 0 && (
            <div className="sp-lg" style={{ borderBottom: 0 }}>
              <span>Nothing has changed since you opened Nexday.</span>
              <span />
            </div>
          )}
          {log.map(([t, m], i) => (
            <div
              className="sp-lg"
              key={t}
              style={i === log.length - 1 ? { borderBottom: 0 } : undefined}
            >
              <span>{t}</span>
              <span>{m}</span>
            </div>
          ))}
        </div>
        <div
          className="row"
          style={{
            justifyContent: 'space-between',
            marginTop: 6,
            paddingTop: 12,
            borderTop: '1px solid #EDEDEB'
          }}
        >
          <button style={{ padding: 0, fontSize: 13, fontWeight: 500 }} onClick={onClose}>
            Calendars &amp; sync settings
          </button>
          <span style={{ color: '#767676', display: 'flex' }}>
            <Icon name="caretRight" size={14} strokeWidth={2} />
          </span>
        </div>
      </div>
    </>
  )
}

/* ---------------- Notification center ---------------- */

type NTab = 'all' | 'unread' | 'mentions'

function NotifGlyph({ n }: { n: Notif }): React.JSX.Element {
  if (n.avatar) {
    return (
      <span className="nf-av" style={{ background: n.avatar.color }}>
        {n.avatar.letter}
      </span>
    )
  }
  return (
    <span className="nf-slot">
      {n.glyph === 'boltFill' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#F38020">
          <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
        </svg>
      ) : (
        <Icon name={n.glyph as IconName} size={16} strokeWidth={1.7} round />
      )}
    </span>
  )
}

export function NotificationPanel(): React.JSX.Element {
  const { closePanel } = useUI()
  const { items, markAllRead, toggleRead, clear } = useNotifs()
  const navigate = useNavigate()
  const quiet = useUI((s) => s.notifPrefs)
  const goSettings = (): void => {
    closePanel()
    navigate('/settings/notifications')
  }
  const [tab, setTab] = useState<NTab>('all')
  useEscape(closePanel)

  const shown = items.filter((n) =>
    tab === 'all' ? true : tab === 'unread' ? n.unread : n.mention
  )
  const tabs: Array<{ id: NTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: items.length },
    { id: 'unread', label: 'Unread', count: unreadCount(items) },
    { id: 'mentions', label: 'Mentions', count: items.filter((n) => n.mention).length }
  ]

  return (
    <>
      <Catcher onClose={closePanel} />
      <div className="np-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ height: 34, gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 500 }}>Notifications</span>
          <span style={{ flex: 1 }} />
          <button
            style={{ fontSize: 13, color: 'var(--ink2)', marginRight: 6 }}
            onClick={markAllRead}
          >
            Mark all read
          </button>
          {items.length > 0 && (
            <button style={{ fontSize: 13, color: 'var(--ink2)', marginRight: 6 }} onClick={clear}>
              Clear all
            </button>
          )}
          <button className="nf-ic" aria-label="Notification settings" onClick={goSettings}>
            <Icon name="gear" strokeWidth={1.7} round />
          </button>
          <button className="nf-ic" aria-label="Close" onClick={closePanel}>
            <Icon name="x" strokeWidth={1.7} round />
          </button>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <div className="nf-seg">
            {tabs.map((t) => (
              <button key={t.id} className={cn(t.id === tab && 'on')} onClick={() => setTab(t.id)}>
                {t.label} <i>{t.count}</i>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {shown.length === 0 && (
            <div className="col" style={{ gap: 6, padding: '48px 0', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>You&apos;re all caught up</span>
              <span className="muted" style={{ fontSize: 13 }}>
                Reminders and plan changes show up here.
              </span>
            </div>
          )}
          {(['Today', 'Yesterday'] as const).map((g, gi) => {
            const list = shown.filter((n) => n.group === g)
            if (list.length === 0) return null
            return (
              <div key={g} className="col">
                <div className="nf-gh" style={gi === 0 ? { paddingTop: 22 } : undefined}>
                  {g}
                </div>
                {list.map((n, i) => (
                  <div
                    key={n.id}
                    className={cn('nf-item', g === 'Yesterday' && i === list.length - 1 && 'last')}
                    onClick={() => toggleRead(n.id)}
                  >
                    <span
                      className="nf-dot"
                      style={{ background: n.unread ? 'var(--acc)' : 'transparent' }}
                    />
                    <NotifGlyph n={n} />
                    <div className="col" style={{ flex: 1 }}>
                      <span className="nf-t">
                        <b>{n.lead}</b>
                        {n.rest}
                      </span>
                      <span className="nf-b">{n.body}</span>
                      {n.actions && (
                        <div className="row" style={{ gap: 8, marginTop: 10 }}>
                          {n.actions.map((a) => (
                            <Button key={a} onClick={(e) => e.stopPropagation()}>
                              {a}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="nf-time">{n.time}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="row" style={{ gap: 8, paddingTop: 14 }}>
          <span style={{ color: '#767676', display: 'flex' }}>
            <Icon name="moon" size={14} strokeWidth={1.8} round />
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>
            {quiet.quietOn ? `Quiet hours ${quiet.quietStart} – ${quiet.quietEnd}` : 'Quiet hours off'}
          </span>
          <span style={{ flex: 1 }} />
          <button style={{ fontSize: 13, color: 'var(--ink2)' }} onClick={goSettings}>
            Notification settings
          </button>
        </div>
      </div>
    </>
  )
}

/* ---------------- Help & feedback ---------------- */

const articles: Array<[string, string]> = [
  ['Plan your day in two minutes', '3 min read'],
  ['Connect Google or Outlook Calendar', '2 min read'],
  ['How auto-schedule picks time slots', '4 min read'],
  ['Turn emails into tasks from Inbox', '2 min read']
]

export function HelpModal(): React.JSX.Element {
  const { closePanel } = useUI()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'Idea' | 'Bug' | 'Question'>('Idea')
  const [text, setText] = useState('')
  useEscape(closePanel)

  const list = articles.filter(([t]) => t.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="help-scrim" onMouseDown={closePanel}>
      <div className="help" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', padding: '24px 24px 14px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 500 }}>Help &amp; feedback</h2>
          <button
            aria-label="Close"
            onClick={closePanel}
            style={{ fontSize: 20, color: '#6B6B6B', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <input
          className="help-search"
          placeholder="Search help articles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div style={{ padding: '20px 24px 0' }}>
          <div className="help-lbl">Getting started</div>
          {list.map(([t, m]) => (
            <button className="help-row" key={t}>
              {t}
              <span>{m}</span>
            </button>
          ))}
          {list.length === 0 && (
            <div className="help-row" style={{ color: '#767676' }}>
              No articles match “{q}”
            </div>
          )}
        </div>
        <div style={{ padding: '20px 24px 0' }}>
          <div className="help-lbl">Quick links</div>
          <button className="help-row">
            Keyboard shortcuts
            <span>
              <b className="help-kb" style={{ fontWeight: 400 }}>
                ?
              </b>
            </span>
          </button>
          <button className="help-row">
            What&apos;s new in Nexday<span>Nov 2026</span>
          </button>
          <button className="help-row">
            Contact support<span>Replies within a day</span>
          </button>
        </div>
        <div style={{ padding: '20px 24px 24px', borderTop: '1px solid #EDEDEB', marginTop: 16 }}>
          <div className="help-lbl">Send feedback</div>
          <div
            className="row"
            style={{ gap: 18, fontSize: 14, marginTop: 4, alignItems: 'flex-end' }}
          >
            {(['Idea', 'Bug', 'Question'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                style={{
                  fontSize: 14,
                  paddingBottom: 3,
                  fontWeight: k === kind ? 500 : 400,
                  color: k === kind ? 'var(--ink)' : '#767676'
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <textarea
            className="help-ta"
            placeholder="Tell us what would make Nexday better…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              marginTop: 14,
              fontSize: 13,
              color: '#6B6B6B'
            }}
          >
            <div>Attach screenshot</div>
            <Button variant="dark" onClick={closePanel} style={{ justifyContent: 'center' }}>
              Send feedback
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- New project ---------------- */

const colors = ['#F38020', '#5B6578', '#A4505A', '#2E8B57', '#3B6FD4']

export function NewProjectPopup(): React.JSX.Element {
  const navigate = useNavigate()
  const closePanel = useUI((s) => s.closePanel)
  const add = useProjects((s) => s.add)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B6FD4')

  const create = (): void => {
    const n = name.trim()
    if (!n) return
    const slug = add(n, color)
    closePanel()
    navigate(`/projects/${slug}`)
  }

  return (
    <Overlay onClose={closePanel} top={200}>
      <div
        className="npj"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            create()
          }
        }}
      >
        <div
          className="row"
          style={{
            justifyContent: 'space-between',
            padding: '24px 24px 0',
            alignItems: 'flex-start'
          }}
        >
          <div className="col" style={{ gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}>New project</span>
            <span className="muted" style={{ fontSize: 13 }}>
              Group tasks, notes and events under one name.
            </span>
          </div>
          <button
            className="row"
            aria-label="Close"
            onClick={closePanel}
            style={{
              width: 30,
              height: 30,
              justifyContent: 'center',
              borderRadius: 8,
              color: 'var(--ink2)'
            }}
          >
            <Icon name="x" size={16} strokeWidth={1.9} />
          </button>
        </div>

        <div className="col" style={{ padding: '24px 24px 14px', gap: 6 }}>
          <div className="row" style={{ gap: 12 }}>
            <div
              style={{ width: 14, height: 14, borderRadius: 4, background: color, flexShrink: 0 }}
            />
            <input
              className="npj-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <span className="muted" style={{ fontSize: 14, paddingLeft: 26 }}>
            What is this project about?
          </span>
        </div>

        <div className="row" style={{ gap: 8, padding: '0 24px 12px' }}>
          <span style={{ color: '#E2680C', display: 'flex' }}>
            <Icon name="bolt" size={14} strokeWidth={2} />
          </span>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {name.toLowerCase().includes('trip') ||
            name.toLowerCase().includes('cappadocia') ||
            name.toLowerCase().includes('weekend')
              ? 'Looks like a trip. Nexday added a packing and booking checklist.'
              : 'Give it a name. Nexday suggests a starting checklist from it.'}
          </span>
        </div>

        <div className="col" style={{ padding: '0 24px' }}>
          <div className="np-prop top">
            <span className="np-pl" style={{ width: 112 }}>
              Color
            </span>
            <div className="row" style={{ gap: 10, flex: 1 }}>
              {colors.map((c) => (
                <button
                  key={c}
                  className={cn('npj-sw', c === color && 'on')}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="np-prop">
            <span className="np-pl" style={{ width: 112 }}>
              Start with
            </span>
            <span className="np-pv">Trip checklist</span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              8 tasks
            </span>
            <span style={{ color: '#767676', display: 'flex' }}>
              <Icon name="chevronDown" size={14} strokeWidth={2} />
            </span>
          </div>
          <div className="np-prop">
            <span className="np-pl" style={{ width: 112 }}>
              Due date
            </span>
            <div className="row" style={{ gap: 8, flex: 1 }}>
              <span style={{ color: '#6B6B6B', display: 'flex' }}>
                <Icon name="calendar" size={15} />
              </span>
              <span className="np-pv mono" style={{ flex: 'none' }}>
                Fri, Dec 4
              </span>
            </div>
          </div>
          <div className="np-prop last">
            <span className="np-pl" style={{ width: 112 }}>
              Time per week
            </span>
            <span className="np-pv mono">2 h</span>
            <span style={{ fontSize: 12.5, color: 'var(--acc-text)', fontWeight: 500 }}>
              Tue and Thu evenings
            </span>
          </div>
        </div>

        <div
          className="row"
          style={{
            marginTop: 'auto',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: '1px solid var(--line)'
          }}
        >
          <div className="row" style={{ gap: 6 }}>
            <Kbd>↵</Kbd>
            <span className="muted" style={{ fontSize: 12 }}>
              Create
            </span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="row" style={{ height: 36, padding: '0 8px' }} onClick={closePanel}>
              <span className="muted" style={{ fontSize: 13 }}>
                Cancel
              </span>
            </button>
            <Button variant="dark" onClick={create} style={{ opacity: name.trim() ? 1 : 0.5 }}>
              Create project
            </Button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}
