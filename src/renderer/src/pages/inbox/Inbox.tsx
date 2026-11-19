import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { INBOX_SUGGESTIONS } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { Button, GroupHeader, Kbd, Segmented, cn } from '../../components/ui'
import { useUI } from '../../store/ui'
import { SnoozePopover } from '../../components/Pickers'
import { projects } from '../../data/tasks'
import { sourceIcon, useInbox, type InboxItem, type InboxSource } from '../../store/inbox'
import { daysFromToday, monthShort, pageDate, parseDayKey, weekdayShort } from '../../lib/clock'
import { aiInboxSuggestion } from '../../lib/ai'
import { useTodayData } from '../../lib/useToday'
import { fmtMin } from '../../lib/today'
import './inbox.css'

const kindLabel = { task: 'Task', event: 'Event', note: 'Note' } as const
const kindIcon = { task: 'tasks', event: 'calendar', note: 'file' } as const

/**
 * The AI answers with "2026-11-24 15:00" (or just a date, or a time). Show it the way capture does:
 * "Today 15:00", "Tomorrow 15:00", "Tue 15:00" within a week, "24 Nov 15:00" beyond. The short
 * forms are also what accepting the suggestion reads back as a day.
 */
function friendlyWhen(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.trim().match(/^(?:(\d{4}-\d{2}-\d{2}))?[ T]?(\d{1,2}:\d{2})?/)
  if (!m || (!m[1] && !m[2])) return raw
  const time = m[2] ? m[2].padStart(5, '0') : ''
  let day = ''
  if (m[1]) {
    const d = parseDayKey(m[1])
    const diff = daysFromToday(d)
    day =
      diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff > 1 && diff < 7 ? weekdayShort(d) : `${d.getDate()} ${monthShort(d)}`
  }
  return [day, time].filter(Boolean).join(' ')
}

/** Capture first (instant), then let AI improve the suggestion in place when it answers. */
function captureWithAi(text: string): void {
  const inbox = useInbox.getState()
  const id = inbox.capture(text)
  void aiInboxSuggestion(text, 'Captured by you · just now · via quick capture', 'capture').then(
    (r) => {
      if ('error' in r) return
      const d = r.data
      const when = friendlyWhen(d.when)
      inbox.refine(id, {
        suggestion: {
          icon: kindIcon[d.kind],
          label: `${kindLabel[d.kind]}${when ? ` · ${when}` : ''}`
        },
        focus: {
          kind: d.kind,
          time: when ?? 'No time yet',
          project: projects[d.project].name,
          duration: d.duration ?? '—',
          reason: d.reason
        }
      })
    }
  )
}

type Filter = 'all' | InboxSource

const sources: Array<{ id: InboxSource; tab: string; label: string }> = [
  { id: 'capture', tab: 'Captured', label: 'Quick capture' },
  { id: 'email', tab: 'Email', label: 'Email' },
  { id: 'slack', tab: 'Slack', label: 'Slack mentions' },
  { id: 'github', tab: 'GitHub', label: 'GitHub reviews' }
]

const groups: Array<{ id: InboxItem['group']; title: string }> = [
  { id: 'new', title: 'New' },
  { id: 'yesterday', title: 'Yesterday' }
]

const slots = [
  { time: '13:00 – 15:00', hint: '2 items suggested', len: '2h', bar: 'var(--acc)' },
  { time: '16:30 – 17:00', hint: 'Open', len: '30m', bar: '#E8C3A0' },
  { time: '18:00 – 19:30', hint: 'Open', len: '1h 30m', bar: 'var(--line2)' }
]

function InboxZero(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <main className="panel">
      <Topbar icon="inbox" section="Inbox" current="Triage" />
      <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <PageHead date={pageDate()} title="Inbox" sub="0 items to triage. Last cleared at 09:52." />
        <div className="zero">
          <span style={{ color: '#BDBDBA', display: 'flex' }}>
            <Icon name="tray" size={44} strokeWidth={1.4} round />
          </span>
          <h2>Inbox zero</h2>
          <p>
            Everything is triaged. New emails, messages and shared items from your connected sources
            will show up here.
          </p>
          <div className="row" style={{ gap: 12, marginTop: 14 }}>
            <Button onClick={() => useUI.getState().openDialog('inboxRules')}>
              Manage sources
            </Button>
            <Button variant="dark" onClick={() => navigate('/tasks')}>
              Open tasks
            </Button>
          </div>
        </div>
      </div>
      <QuickCapture
        placeholder={'Capture anything… "call the landlord about the deposit"'}
        button="Add"
        hint="Captured items land here until you plan them."
        suggestions={INBOX_SUGGESTIONS}
        onSubmit={captureWithAi}
      />
    </main>
  )
}

export default function Inbox(): React.JSX.Element {
  const { items, accept, dismiss } = useInbox()
  const [filter, setFilter] = useState<Filter>('all')
  const { data: today } = useTodayData()
  const freeMin = today.gaps.reduce((n, g) => n + (g.end - g.start), 0)

  if (items.length === 0) return <InboxZero />

  const countOf = (s: InboxSource): number => items.filter((i) => i.source === s).length
  const tabs = [
    { id: 'all' as Filter, label: 'All', count: items.length },
    ...sources.map((s) => ({ id: s.id as Filter, label: s.tab, count: countOf(s.id) }))
  ]
  const visible = filter === 'all' ? items : items.filter((i) => i.source === filter)
  const firstId = visible[0]?.id

  return (
    <main className="panel">
      <Topbar icon="inbox" section="Inbox" current="Triage" />

      <div className="panel-scroll">
        <PageHead
          date={pageDate()}
          title={`${items.length} ${items.length === 1 ? 'item' : 'items'} to triage`}
          sub="Everything you captured or got mentioned in, with a time already suggested."
          stats={[
            ['Waiting', String(items.length)],
            ['Free today', freeMin ? fmtMin(freeMin) : '—']
          ]}
        />

        <div className="inbox-toolbar">
          <Segmented items={tabs} value={filter} onChange={setFilter} />
          <div className="row" style={{ gap: 10 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Accept all suggestions
            </span>
            <Kbd>⇧ ↵</Kbd>
          </div>
        </div>

        <div className="inbox-body">
          <section className="inbox-list">
            {groups.map((g) => {
              const list = visible.filter((i) => i.group === g.id)
              if (list.length === 0) return null
              return (
                <div key={g.id} className="col">
                  <GroupHeader title={g.title} meta={String(list.length)} />
                  {list.map((item, n) => {
                    const lastOfAll = item.id === visible[visible.length - 1].id
                    if (item.id === firstId && item.focus) {
                      return (
                        <FocusCard
                          key={item.id}
                          item={item}
                          position={items.findIndex((i) => i.id === item.id) + 1}
                          total={items.length}
                          onAccept={() => accept(item.id)}
                          onDismiss={() => dismiss(item.id)}
                        />
                      )
                    }
                    return (
                      <div
                        className={cn('item', lastOfAll && n === list.length - 1 && 'last')}
                        key={item.id}
                      >
                        <div className="src">
                          <Icon name={sourceIcon[item.source]} />
                        </div>
                        <div className="col" style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 500 }}>{item.title}</span>
                          <span className="muted" style={{ fontSize: 12.5 }}>
                            {item.meta}
                          </span>
                        </div>
                        <div className={cn('sug', item.suggestion.plain && 'plain')}>
                          <Icon name={item.suggestion.icon} size={13} />
                          <span>{item.suggestion.label}</span>
                        </div>
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            className="ib"
                            style={{ color: 'var(--acc-text)' }}
                            aria-label="Accept"
                            onClick={() => accept(item.id)}
                          >
                            <Icon name="check" size={14} strokeWidth={2.2} />
                          </button>
                          <button
                            className="ib"
                            aria-label="Dismiss"
                            onClick={() => dismiss(item.id)}
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </section>

          <aside className="inbox-side">
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>Free time today</span>
                <span className="mono muted" style={{ fontSize: 12.5 }}>
                  4h
                </span>
              </div>
              <span className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                Suggestions land in these gaps.
              </span>
              <div className="col" style={{ marginTop: 8 }}>
                {slots.map((s, i) => (
                  <div className={cn('slot', i === slots.length - 1 && 'last')} key={s.time}>
                    <div className="slot-bar" style={{ background: s.bar }} />
                    <div className="col" style={{ flex: 1, lineHeight: 1.3 }}>
                      <span className="mono" style={{ fontSize: 13.5, fontWeight: 500 }}>
                        {s.time}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {s.hint}
                      </span>
                    </div>
                    <span className="mono muted" style={{ fontSize: 12.5 }}>
                      {s.len}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col">
              <div className="side-head">
                <h2>Sources</h2>
                <a
                  href="#/inbox"
                  className="muted"
                  style={{ fontSize: 12.5 }}
                  onClick={(e) => {
                    e.preventDefault()
                    useUI.getState().openDialog('inboxRules')
                  }}
                >
                  Manage
                </a>
              </div>
              {sources.map((s, i) => (
                <div className={cn('source-row', i === sources.length - 1 && 'last')} key={s.id}>
                  <div className="src sm">
                    <Icon name={sourceIcon[s.id]} size={14} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13.5 }}>{s.label}</span>
                  <span className="mono muted" style={{ fontSize: 12.5 }}>
                    {countOf(s.id)}
                  </span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="row" style={{ gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--acc)',
                    boxShadow: '0 0 0 4px var(--acc-soft)'
                  }}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  Suggested rule
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 500, marginTop: 10 }}>
                Make this automatic?
              </span>
              <span className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                You always file Ece&apos;s emails under Planner MVP.
              </span>
              <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
                <button className="row" style={{ height: 34, padding: '0 4px' }}>
                  <span className="muted" style={{ fontSize: 13 }}>
                    Not now
                  </span>
                </button>
                <Button variant="dark">
                  <span>Create rule</span>
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <QuickCapture
        placeholder={'Capture anything… "call dentist next week #personal"'}
        button="Send"
        hint="Everything you capture lands here first, then Nexday suggests where it belongs."
        suggestions={INBOX_SUGGESTIONS}
        onSubmit={captureWithAi}
      />
    </main>
  )
}

function FocusCard({
  item,
  position,
  total,
  onAccept,
  onDismiss
}: {
  item: InboxItem
  position: number
  total: number
  onAccept: () => void
  onDismiss: () => void
}): React.JSX.Element {
  const f = item.focus!
  const [snooze, setSnooze] = useState<{ left: number; top: number } | null>(null)
  return (
    <div className="focus">
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div className="src">
          <Icon name={sourceIcon[item.source]} />
        </div>
        <div className="col" style={{ flex: 1, gap: 2 }}>
          <span className="focus-title">{item.title}</span>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {item.meta}
          </span>
        </div>
        <span style={{ marginTop: 4 }}>
          <Kbd>
            {position} of {total}
          </Kbd>
        </span>
      </div>

      <div className="col" style={{ marginTop: 22, gap: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          <span style={{ color: '#E2680C', display: 'flex' }}>
            <Icon name="bolt" size={13} strokeWidth={2} />
          </span>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Nexday suggests
          </span>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink2)' }}>
          Add it as a <span className="edit-word">{f.kind}</span> today at{' '}
          <span className="mono edit-word">{f.time}</span> in{' '}
          <span className="edit-word">{f.project}</span>, for{' '}
          <span className="mono edit-word">{f.duration}</span>.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink2)' }}>{f.reason}</p>
      </div>

      <div className="row" style={{ marginTop: 16, gap: 10 }}>
        <Button variant="dark" onClick={onAccept}>
          <Icon name="check" size={15} strokeWidth={2.4} />
          <span>Add to plan</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>↵</span>
        </Button>
        <Button className="ghost">
          <span>Edit</span>
          <Kbd>E</Kbd>
        </Button>
        <Button
          className="ghost"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setSnooze({ left: r.left - 17, top: r.bottom + 15 })
          }}
        >
          <Icon name="clock" size={15} />
          <span>Snooze</span>
          <Kbd>S</Kbd>
        </Button>
        <span style={{ flex: 1 }} />
        <button
          className="row muted"
          style={{ gap: 6, height: 36, padding: '0 8px' }}
          onClick={onDismiss}
        >
          <Icon name="x" size={15} />
          <span style={{ fontSize: 13 }}>Dismiss</span>
        </button>
      </div>
      {snooze && (
        <SnoozePopover anchor={snooze} onPick={() => onDismiss()} onClose={() => setSnooze(null)} />
      )}
    </div>
  )
}
