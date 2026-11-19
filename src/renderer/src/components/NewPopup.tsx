import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { Overlay } from './Overlay'
import { Button, Kbd, cn } from './ui'
import { useUI, type NewType } from '../store/ui'
import { useTasks } from '../store/tasks'
import { useHabits } from '../store/habits'
import { useNotes } from '../store/notes'
import { useCalendar } from '../store/calendar'
import { parseCapture, toTask } from '../lib/capture'
import { addDays, appToday, dayKey, daysFromToday, parseDayKey } from '../lib/clock'
import { DatePicker, formatWhen, type When } from './Pickers'
import './overlays.css'

type Trail =
  | { kind: 'chevron' }
  | { kind: 'plus' }
  | { kind: 'tag'; text: string }
  | { kind: 'hint'; text: string }
  | { kind: 'toggle' }
  | null

type Prop =
  | { label: string; kind: 'when'; text: string; trail: Trail }
  | { label: string; kind: 'swatch'; color: string; text: string; trail: Trail }
  | { label: string; kind: 'value'; text: ReactNode; mono?: boolean; trail: Trail }
  | { label: string; kind: 'placeholder'; text: string; trail: Trail }
  | { label: string; kind: 'avatar'; letter: string; text: string; trail: Trail }
  | { label: string; kind: 'days'; on: number }

type Config = {
  tab: { id: NewType; label: string; icon: IconName }
  placeholder: string
  sub: string
  hint: string
  props: Prop[]
  hints: Array<[string, string]>
  ghost: string
  create: string
}

/** The recurrence shapes Nexday can write both to its own table and to Mac Calendar. */
const REPEATS: Array<{ label: string; rule: string | null }> = [
  { label: 'Does not repeat', rule: null },
  { label: 'Every day', rule: 'FREQ=DAILY' },
  { label: 'Every week', rule: 'FREQ=WEEKLY' },
  { label: 'Every weekday', rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Every month', rule: 'FREQ=MONTHLY' }
]

const tabs: Array<{ id: NewType; label: string; icon: IconName }> = [
  { id: 'task', label: 'Task', icon: 'tasks' },
  { id: 'event', label: 'Event', icon: 'calendar' },
  { id: 'note', label: 'Note', icon: 'notes' },
  { id: 'habit', label: 'Habit', icon: 'habits' }
]

const configs: Record<NewType, Omit<Config, 'tab'>> = {
  task: {
    placeholder: 'What needs doing?',
    sub: 'Add details, links or a note…',
    hint: 'Nexday found a time and a project from your words. Change anything below.',
    props: [
      {
        label: 'When',
        kind: 'when',
        text: 'Today, 13:30 – 13:45',
        trail: { kind: 'tag', text: 'Suggested slot' }
      },
      {
        label: 'Project',
        kind: 'swatch',
        color: 'var(--work)',
        text: 'Moving house',
        trail: { kind: 'chevron' }
      },
      { label: 'Length', kind: 'value', text: '15 min', mono: true, trail: { kind: 'chevron' } },
      {
        label: 'Energy',
        kind: 'value',
        text: 'Light',
        trail: { kind: 'hint', text: 'Fits your free gap' }
      },
      { label: 'Repeat', kind: 'value', text: 'Does not repeat', trail: { kind: 'chevron' } },
      {
        label: 'Link',
        kind: 'placeholder',
        text: 'Add a note or an event',
        trail: { kind: 'plus' }
      }
    ],
    hints: [
      ['↵', 'Create'],
      ['⌘ ↵', 'Create and add another']
    ],
    ghost: 'Send to Inbox',
    create: 'Create task'
  },
  event: {
    placeholder: 'Event title',
    sub: 'Add a place, a Meet link or a note…',
    hint: 'Nexday read a time and a guest from your words. Change anything below.',
    props: [
      {
        label: 'When',
        kind: 'when',
        text: 'Tomorrow, 15:00 – 16:00',
        trail: { kind: 'tag', text: 'You are free' }
      },
      {
        label: 'Calendar',
        kind: 'swatch',
        color: 'var(--personal)',
        text: 'Personal',
        trail: { kind: 'chevron' }
      },
      { label: 'Guests', kind: 'avatar', letter: 'E', text: 'Ece Çelik', trail: { kind: 'plus' } },
      {
        label: 'Where',
        kind: 'placeholder',
        text: 'Add a place or a Meet link',
        trail: { kind: 'plus' }
      },
      { label: 'Reminder', kind: 'value', text: '10 minutes before', trail: { kind: 'chevron' } }
    ],
    hints: [
      ['↵', 'Create'],
      ['⌘ ↵', 'Create and add another']
    ],
    ghost: 'Cancel',
    create: 'Create event'
  },
  note: {
    placeholder: 'Note title',
    sub: 'Start writing, or press / for commands…',
    hint: 'Nexday links this note to your event and pulls out the action items.',
    props: [
      {
        label: 'Event',
        kind: 'when',
        text: 'Design critique · Today 15:00',
        trail: { kind: 'tag', text: 'Suggested' }
      },
      {
        label: 'Project',
        kind: 'swatch',
        color: 'var(--acc)',
        text: 'Planner MVP',
        trail: { kind: 'chevron' }
      },
      {
        label: 'Template',
        kind: 'value',
        text: 'Meeting notes',
        trail: { kind: 'hint', text: 'Goals, notes, action items' }
      },
      { label: 'Shared with', kind: 'value', text: 'Only me', trail: { kind: 'chevron' } },
      {
        label: 'Link',
        kind: 'placeholder',
        text: 'Add a task or a project',
        trail: { kind: 'plus' }
      }
    ],
    hints: [
      ['↵', 'Create'],
      ['⌘ ↵', 'Create and open']
    ],
    ghost: 'Open as full page',
    create: 'Create note'
  },
  habit: {
    placeholder: 'Name your habit',
    sub: 'Add why it matters, or a note to yourself…',
    hint: 'Nexday found 5 slots a day that stay clear on your calendar.',
    props: [
      { label: 'Repeat', kind: 'days', on: 5 },
      {
        label: 'Time',
        kind: 'value',
        text: 'Every 2 hours · 09:00 – 17:00',
        mono: true,
        trail: { kind: 'tag', text: '5 slots' }
      },
      { label: 'Length', kind: 'value', text: '5 min', mono: true, trail: { kind: 'chevron' } },
      {
        label: 'Calendar',
        kind: 'value',
        text: 'Reserve a slot for each',
        trail: { kind: 'toggle' }
      },
      { label: 'Reminder', kind: 'value', text: 'At the start', trail: { kind: 'chevron' } },
      { label: 'Goal', kind: 'value', text: 'Streak of 14 days', trail: { kind: 'chevron' } }
    ],
    hints: [
      ['↵', 'Create'],
      ['⌘ ↵', 'Create and add another']
    ],
    ghost: 'Cancel',
    create: 'Create habit'
  }
}

function TrailView({ trail }: { trail: Trail }): React.JSX.Element | null {
  if (!trail) return null
  switch (trail.kind) {
    case 'chevron':
      return (
        <span style={{ color: '#767676', display: 'flex' }}>
          <Icon name="chevronDown" size={14} strokeWidth={2} />
        </span>
      )
    case 'plus':
      return (
        <span style={{ color: '#767676', display: 'flex' }}>
          <Icon name="plus" size={14} strokeWidth={2} />
        </span>
      )
    case 'tag':
      return (
        <span style={{ fontSize: 12.5, color: 'var(--acc-text)', fontWeight: 500 }}>
          {trail.text}
        </span>
      )
    case 'hint':
      return (
        <span className="muted" style={{ fontSize: 12.5 }}>
          {trail.text}
        </span>
      )
    case 'toggle':
      return <span className="np-tg on" />
  }
}

function PropRow({
  p,
  i,
  last,
  onWhen,
  onClick
}: {
  p: Prop
  i: number
  last: boolean
  onWhen?: () => void
  onClick?: () => void
}): React.JSX.Element {
  const cls = cn('np-prop', i === 0 && 'top', last && 'last')
  if (p.kind === 'days') {
    return (
      <div className={cls}>
        <span className="np-pl">{p.label}</span>
        <div className="row" style={{ gap: 6, flex: 1 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, n) => (
            <span className={cn('np-dy', n < p.on && 'on')} key={n}>
              {d}
            </span>
          ))}
        </div>
      </div>
    )
  }
  let value: ReactNode
  if (p.kind === 'when') {
    const [head, tail] = p.text.split(' · ')
    value = (
      <div className="row" style={{ gap: 8, flex: 1 }}>
        <span style={{ color: '#6B6B6B', display: 'flex' }}>
          <Icon name="calendar" size={15} />
        </span>
        <span className="np-pv" style={{ flex: 'none' }}>
          {tail ? (
            <>
              {head} · <span className="mono">{tail}</span>
            </>
          ) : (
            <span className="mono">{head}</span>
          )}
        </span>
      </div>
    )
  } else if (p.kind === 'swatch') {
    value = (
      <div className="row" style={{ gap: 8, flex: 1 }}>
        <div className="swatch" style={{ background: p.color }} />
        <span className="np-pv" style={{ flex: 'none' }}>
          {p.text}
        </span>
      </div>
    )
  } else if (p.kind === 'avatar') {
    value = (
      <div className="row" style={{ gap: 8, flex: 1 }}>
        <span className="np-av">{p.letter}</span>
        <span className="np-pv" style={{ flex: 'none' }}>
          {p.text}
        </span>
      </div>
    )
  } else if (p.kind === 'placeholder') {
    value = (
      <span className="np-pv muted" style={{ fontWeight: 400 }}>
        {p.text}
      </span>
    )
  } else {
    value = <span className={cn('np-pv', p.mono && 'mono')}>{p.text}</span>
  }
  const click = p.kind === 'when' && p.label === 'When' ? onWhen : onClick
  return (
    <div className={cls} onClick={click} style={click ? { cursor: 'pointer' } : undefined}>
      <span className="np-pl">{p.label}</span>
      {value}
      <TrailView trail={p.trail} />
    </div>
  )
}

export function NewPopup({ type }: { type: NewType }): React.JSX.Element {
  const navigate = useNavigate()
  const { closeNew, openNew, newTitle } = useUI()
  const [title, setTitle] = useState(newTitle)
  const c = configs[type]
  const [pickerOpen, setPickerOpen] = useState(false)
  const [when, setWhen] = useState<When | null>(null)
  const [allDay, setAllDay] = useState(false)
  const [repeat, setRepeat] = useState(0)

  const create = (): void => {
    const text = title.trim()
    let noteId: string | null = null
    if (type === 'task' && text) {
      const parsed = parseCapture(text)
      // The When picker wins over words in the title; untouched, the suggested slot (today 13:30) applies.
      const day = when ? when.day : dayKey(appToday())
      const diff = day === null ? null : daysFromToday(parseDayKey(day))
      const group =
        diff === null ? 'no-time' : diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : 'next-week'
      const hasWords = parsed.title !== text
      const base = hasWords ? parsed : { ...parsed, group, time: when ? when.start : '13:30' }
      const { task, group: g } = toTask(base as typeof parsed, 'moving')
      useTasks.getState().add(task, g)
    } else if (type === 'habit' && text) {
      useHabits.getState().add(text)
    } else if (type === 'event' && text) {
      // The design's default when nobody touched the picker: tomorrow 15:00 – 16:00.
      const w = when ?? { day: dayKey(addDays(appToday(), 1)), start: '15:00', end: '16:00' }
      useCalendar.getState().add({
        title: text,
        date: w.day ?? dayKey(appToday()),
        start: w.start,
        end: w.end,
        allDay,
        rrule: REPEATS[repeat].rule
      })
    } else if (type === 'note' && text) {
      noteId = useNotes.getState().add(text)
    }
    closeNew()
    if (noteId) navigate(`/notes/${noteId}`)
  }

  return (
    <Overlay onClose={pickerOpen ? () => setPickerOpen(false) : closeNew} instant>
      <div
        className="np"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            create()
          }
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', padding: '24px 24px 0' }}>
          <div className="row" style={{ gap: 4 }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                className={cn('np-type', t.id === type && 'on')}
                onClick={() => openNew(t.id, title)}
              >
                <Icon name={t.icon} size={15} strokeWidth={1.9} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <button
            className="row"
            aria-label="Close"
            onClick={closeNew}
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

        <div className="col" style={{ padding: '22px 24px 14px', gap: 6 }}>
          <input
            className="np-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={c.placeholder}
          />
          <span className="muted" style={{ fontSize: 14 }}>
            {c.sub}
          </span>
        </div>

        <div className="row" style={{ gap: 8, padding: '0 24px 12px' }}>
          <span style={{ color: '#E2680C', display: 'flex' }}>
            <Icon name="bolt" size={14} strokeWidth={2} />
          </span>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {c.hint}
          </span>
        </div>

        <div className="col" style={{ padding: '0 24px' }}>
          {c.props.map((p, i) => {
            const shown =
              p.kind === 'when' && p.label === 'When' && when ? { ...p, text: formatWhen(when) } : p
            return (
              <PropRow
                key={p.label}
                p={shown}
                i={i}
                last={type !== 'event' && i === c.props.length - 1}
                onWhen={() => setPickerOpen(true)}
              />
            )
          })}
          {type === 'event' && (
            <>
              <PropRow
                p={{
                  label: 'All day',
                  kind: 'value',
                  text: allDay ? 'Yes' : 'No',
                  trail: allDay ? { kind: 'toggle' } : null
                }}
                i={c.props.length}
                last={false}
                onClick={() => setAllDay(!allDay)}
              />
              <PropRow
                p={{
                  label: 'Repeat',
                  kind: 'value',
                  text: REPEATS[repeat].label,
                  trail: { kind: 'chevron' }
                }}
                i={c.props.length + 1}
                last
                onClick={() => setRepeat((r) => (r + 1) % REPEATS.length)}
              />
            </>
          )}
        </div>

        {pickerOpen && (
          <DatePicker
            value={
              when ??
              (type === 'event'
                ? { day: dayKey(addDays(appToday(), 1)), start: '15:00', end: '16:00' }
                : { day: dayKey(appToday()), start: '13:30', end: '13:45' })
            }
            onChange={setWhen}
            onClose={() => setPickerOpen(false)}
          />
        )}

        <div
          className="row"
          style={{
            marginTop: 'auto',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: '1px solid var(--line)'
          }}
        >
          <div className="row" style={{ gap: 14 }}>
            {c.hints.map(([k, label]) => (
              <div className="row" style={{ gap: 6 }} key={label}>
                <Kbd>{k}</Kbd>
                <span className="muted" style={{ fontSize: 12 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="row" style={{ height: 36, padding: '0 8px' }} onClick={closeNew}>
              <span className="muted" style={{ fontSize: 13 }}>
                {c.ghost}
              </span>
            </button>
            <Button variant="dark" onClick={create}>
              <span>{c.create}</span>
            </Button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}
