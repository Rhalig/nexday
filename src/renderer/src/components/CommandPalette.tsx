import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { Overlay } from './Overlay'
import { cn } from './ui'
import { useUI, type NewType } from '../store/ui'
import { useTasks } from '../store/tasks'
import { useCalendar } from '../store/calendar'
import { useNotes } from '../store/notes'
import { projects as projectNames } from '../data/tasks'
import { appToday, dayKey, parseDayKey, weekdayLong } from '../lib/clock'
import './overlays.css'

type Kind = 'action' | 'task' | 'note' | 'event' | 'project'
type Entry = {
  id: string
  group: 'Suggested' | 'Create' | 'Recent'
  kind: Kind
  icon: IconName | 'box' | 'dot'
  dotColor?: string
  title: string
  meta?: string
  keys?: string[]
  right?: string
  run: 'plan' | 'inbox' | 'focus' | 'project' | `new:${NewType}` | 'newproject' | 'none'
}

const entries: Entry[] = [
  {
    id: 'plan',
    group: 'Suggested',
    kind: 'action',
    icon: 'bolt',
    title: 'Plan my afternoon',
    meta: 'Fill 13:00–15:00 with 2 tasks',
    keys: ['↵'],
    run: 'plan'
  },
  {
    id: 'inbox',
    group: 'Suggested',
    kind: 'action',
    icon: 'calendarLg',
    title: 'Review inbox',
    meta: '6 items to triage',
    keys: ['G', 'I'],
    run: 'inbox'
  },
  {
    id: 'focus',
    group: 'Suggested',
    kind: 'action',
    icon: 'clock',
    title: 'Start focus session',
    meta: 'Work on your next task with a timer',
    run: 'focus'
  },
  {
    id: 'nt',
    group: 'Create',
    kind: 'action',
    icon: 'plus',
    title: 'New task',
    keys: ['⌘', 'T'],
    run: 'new:task'
  },
  {
    id: 'ne',
    group: 'Create',
    kind: 'action',
    icon: 'plus',
    title: 'New event',
    keys: ['⌘', 'E'],
    run: 'new:event'
  },
  {
    id: 'nn',
    group: 'Create',
    kind: 'action',
    icon: 'plus',
    title: 'New note',
    keys: ['⌘', 'N'],
    run: 'new:note'
  },
  {
    id: 'np',
    group: 'Create',
    kind: 'action',
    icon: 'plus',
    title: 'New project',
    keys: ['⌘', '⇧', 'P'],
    run: 'newproject'
  },
  {
    id: 'r1',
    group: 'Recent',
    kind: 'task',
    icon: 'box',
    title: 'Book moving van',
    meta: 'Moving house',
    right: 'Today',
    run: 'none'
  },
  {
    id: 'r2',
    group: 'Recent',
    kind: 'note',
    icon: 'docPlain',
    title: 'Sprint planning notes',
    meta: 'Planner MVP',
    right: 'Yesterday',
    run: 'none'
  },
  {
    id: 'r3',
    group: 'Recent',
    kind: 'project',
    icon: 'dot',
    dotColor: '#5B6578',
    title: 'Planner MVP',
    meta: '7 tasks',
    right: 'Project',
    run: 'project'
  }
]

const tabs: Array<{ id: 'all' | Kind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'task', label: 'Tasks' },
  { id: 'note', label: 'Notes' },
  { id: 'event', label: 'Events' },
  { id: 'project', label: 'Projects' }
]

type Hit = {
  id: string
  kind: Exclude<Kind, 'action'>
  title: string
  project: string
  right: string
  to: string
}

const hh = (n: number): string => `${String(Math.floor(n)).padStart(2, '0')}:${n % 1 ? '30' : '00'}`

const extraNotes: Hit[] = [
  {
    id: 'x1',
    kind: 'note',
    title: 'Feedback template for critique sessions',
    project: 'Ideas',
    right: 'Last week',
    to: '/notes'
  }
]

function Match({ text, q }: { text: string; q: string }): React.JSX.Element {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0 || !q) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <b style={{ fontWeight: 500 }}>{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  )
}

const hitIcon: Record<Exclude<Kind, 'action'>, IconName | 'box'> = {
  task: 'box',
  event: 'calendar',
  note: 'docPlain',
  project: 'folder'
}
const hitGroups: Array<{ kind: Exclude<Kind, 'action'>; label: string }> = [
  { kind: 'task', label: 'Tasks' },
  { kind: 'event', label: 'Events' },
  { kind: 'note', label: 'Notes' },
  { kind: 'project', label: 'Projects' }
]

export function CommandPalette(): React.JSX.Element {
  const navigate = useNavigate()
  const { closePalette, openNew, openPanel, openDialog } = useUI()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('all')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (tab !== 'all' && e.kind !== tab) return false
      if (!q) return true
      return `${e.title} ${e.meta ?? ''}`.toLowerCase().includes(q)
    })
  }, [query, tab])

  const groupsData = useTasks((st) => st.groups)
  const calEvents = useCalendar((st) => st.events)
  const allNotes = useNotes((st) => st.notes)
  const q = query.trim()
  const hits = useMemo<Hit[]>(() => {
    if (!q) return []
    const all: Hit[] = [
      ...groupsData.flatMap((g) =>
        g.tasks.map((t) => ({
          id: t.id,
          kind: 'task' as const,
          title: t.title,
          project: projectNames[t.project].name,
          right: t.time ? `${g.title} ${t.time.split(' · ')[0]}` : g.title,
          to: `/tasks/${t.id}`
        }))
      ),
      ...calEvents.map((e) => ({
        id: e.id,
        kind: 'event' as const,
        title: e.title,
        project: e.sub?.split(' · ')[1] ?? 'Calendar',
        right: `${e.date === dayKey(appToday()) ? 'Today' : weekdayLong(parseDayKey(e.date))} ${e.allDay ? '· All day' : hh(e.start)}`,
        to: '/calendar'
      })),
      ...allNotes.map((n) => ({
        id: n.id,
        kind: 'note' as const,
        title: n.title,
        project: n.chip.name,
        right: n.group === 'today' ? 'Today' : n.when.text,
        to: `/notes/${n.id}`
      })),
      ...extraNotes
    ]
    return all.filter((h) => h.title.toLowerCase().includes(q.toLowerCase()))
  }, [q, groupsData, calEvents, allNotes])
  const shownHits = tab === 'all' ? hits : hits.filter((h) => h.kind === tab)
  const hitOrder = hitGroups.flatMap((g) => shownHits.filter((h) => h.kind === g.kind))
  const searching = q.length > 0

  const run = (e: Entry): void => {
    if (e.run.startsWith('new:')) {
      openNew(e.run.slice(4) as NewType)
      return
    }
    if (e.run === 'newproject') {
      openPanel('newProject')
      return
    }
    closePalette()
    if (e.run === 'plan') {
      openDialog('autoSchedule')
      return
    }
    if (e.run === 'inbox') navigate('/inbox')
    if (e.run === 'focus') navigate('/focus')
    if (e.run === 'project') navigate('/projects/planner-mvp')
  }

  const onKeyDown = (ev: React.KeyboardEvent): void => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setActive((i) =>
        Math.min(i + 1, Math.max((searching ? hitOrder.length : visible.length) - 1, 0))
      )
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (ev.key === 'Enter') {
      ev.preventDefault()
      if (searching) {
        const h = hitOrder[active]
        if (h) {
          closePalette()
          navigate(h.to)
        }
        return
      }
      const e = visible[active]
      if (e) run(e)
    } else if (ev.key === 'Tab') {
      ev.preventDefault()
      const i = tabs.findIndex((t) => t.id === tab)
      setTab(tabs[(i + (ev.shiftKey ? tabs.length - 1 : 1)) % tabs.length].id)
      setActive(0)
    }
  }

  const groups = (['Suggested', 'Create', 'Recent'] as const).map((g) => ({
    name: g,
    items: visible.filter((e) => e.group === g)
  }))

  return (
    <Overlay onClose={closePalette}>
      <div className={cn('pal', searching && 'search')} onKeyDown={onKeyDown}>
        <div className="pal-search">
          <span style={{ display: 'flex' }}>
            <Icon name="search" size={18} strokeWidth={1.8} round />
          </span>
          <input
            className="pal-input"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Search or type a command…"
          />
          <span className="pal-kbd">esc</span>
        </div>
        <div className="pal-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={cn('pal-tab', t.id === tab && 'on')}
              onClick={() => {
                setTab(t.id)
                setActive(0)
              }}
            >
              {t.label}
              {searching && (
                <span className="pal-ct">
                  {t.id === 'all' ? hits.length : hits.filter((h) => h.kind === t.id).length}
                </span>
              )}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span className="pal-hint">
            <span className="pal-kbd">tab</span>switch
          </span>
        </div>
        {searching ? (
          <div className="pal-list">
            {hitOrder.length === 0 && <div className="pal-empty">No results for “{query}”</div>}
            {hitGroups.map((g) => {
              const items = shownHits.filter((h) => h.kind === g.kind)
              if (!items.length) return null
              return (
                <div className="col" key={g.kind}>
                  <div className="pal-h">{g.label}</div>
                  {items.map((h) => {
                    const idx = hitOrder.indexOf(h)
                    return (
                      <div
                        key={h.id}
                        className={cn('pal-item hit', idx === active && 'on')}
                        onMouseMove={() => setActive(idx)}
                        onClick={() => {
                          closePalette()
                          navigate(h.to)
                        }}
                      >
                        <span className="ic">
                          {hitIcon[h.kind] === 'box' ? (
                            <span
                              style={{
                                width: 15,
                                height: 15,
                                border: '1.5px solid #BDBDBA',
                                borderRadius: 5
                              }}
                            />
                          ) : (
                            <Icon
                              name={hitIcon[h.kind] as IconName}
                              size={17}
                              strokeWidth={1.6}
                              round
                            />
                          )}
                        </span>
                        <span className="t">
                          <Match text={h.title} q={q} />
                        </span>
                        <span className="m" style={{ fontSize: 12.5 }}>
                          {h.project}
                        </span>
                        <span style={{ flex: 1 }} />
                        <span className="m" style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
                          {h.right}
                        </span>
                        {idx === active && <span className="pal-kbd">↵</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="pal-list" ref={listRef}>
            {visible.length === 0 && <div className="pal-empty">No results for “{query}”</div>}
            {groups.map(
              (g) =>
                g.items.length > 0 && (
                  <div className="col" key={g.name}>
                    <div className="pal-h">{g.name}</div>
                    {g.items.map((e) => {
                      const idx = visible.indexOf(e)
                      return (
                        <div
                          key={e.id}
                          className={cn('pal-item', idx === active && 'on')}
                          onMouseMove={() => setActive(idx)}
                          onClick={() => run(e)}
                        >
                          <span className="ic">
                            {e.icon === 'box' ? (
                              <span
                                style={{
                                  width: 15,
                                  height: 15,
                                  border: '1.5px solid #BDBDBA',
                                  borderRadius: 5
                                }}
                              />
                            ) : e.icon === 'dot' ? (
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 2,
                                  background: e.dotColor
                                }}
                              />
                            ) : (
                              <Icon name={e.icon} size={17} strokeWidth={1.6} round />
                            )}
                          </span>
                          <span className="t">{e.title}</span>
                          {e.meta && <span className="m">{e.meta}</span>}
                          <span style={{ flex: 1 }} />
                          {e.right && <span className="m">{e.right}</span>}
                          {e.keys?.map((k, i) => (
                            <span className="pal-kbd" key={i}>
                              {k}
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )
            )}
          </div>
        )}
        <div className="pal-foot">
          <span className="pal-hint">
            <span className="pal-kbd">↑</span>
            <span className="pal-kbd">↓</span>Navigate
          </span>
          <span className="pal-hint">
            <span className="pal-kbd">↵</span>Open
          </span>
          {!searching && (
            <span className="pal-hint">
              <span className="pal-kbd">⌘</span>
              <span className="pal-kbd">↵</span>Add to plan
            </span>
          )}
          <span style={{ flex: 1 }} />
          {searching ? (
            <span className="pal-hint" style={{ color: '#B4500A' }}>
              {hitOrder.length} result{hitOrder.length === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="pal-hint" style={{ color: 'var(--acc-text)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#F38020">
                <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
              </svg>
              Type naturally to add
            </span>
          )}
        </div>
      </div>
    </Overlay>
  )
}
