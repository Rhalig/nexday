import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { Overlay } from './Overlay'
import { Button, Kbd, cn } from './ui'
import { useUI, type NewType } from '../store/ui'
import { useTasks } from '../store/tasks'
import { useHabits } from '../store/habits'
import { captureWithAi } from '../pages/inbox/Inbox'
import { useNotes } from '../store/notes'
import { useCalendar } from '../store/calendar'
import { parseCapture, toTask } from '../lib/capture'
import { addDays, appToday, dayKey, daysFromToday, parseDayKey } from '../lib/clock'
import { DatePicker, formatWhen, type When } from './Pickers'
import { DaysField, SelectField, SwitchField, TextField, TimeField, type Opt } from './NewFields'
import { projects as projectInfo, type Energy } from '../data/tasks'
import { projectColor } from './ui'
import { useProjects } from '../store/projects'
import { noteTemplates, templateText } from '../data/noteTemplates'
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
    hint: 'Pick a project and a template, or just start writing.',
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
    hint: 'Pick the days and the time. It repeats on those days.',
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

const LENGTHS = [5, 10, 15, 20, 30, 45, 60, 90, 120]
const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const plusMin = (hhmm: string, n: number): string => {
  const t = Math.min(23 * 60 + 59, toMin(hhmm) + n)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const lenLabel = (n: number): string => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}` : `${n} min`)
const CALENDARS: Opt[] = [
  { value: 'personal', label: 'Personal', swatch: 'var(--personal)' },
  { value: 'work', label: 'Work', swatch: 'var(--work)' },
  { value: 'acc', label: 'Planner MVP', swatch: 'var(--acc)' }
]

export function NewPopup({ type }: { type: NewType }): React.JSX.Element {
  const navigate = useNavigate()
  const { closeNew, openNew, newTitle } = useUI()
  useProjects((s) => s.custom) // re-render when projects are added or renamed
  const [title, setTitle] = useState(newTitle)
  const c = configs[type]
  const [pickerOpen, setPickerOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [when, setWhen] = useState<When | null>(null)
  const [allDay, setAllDay] = useState(false)
  const [repeat, setRepeat] = useState(0)
  const [project, setProject] = useState('personal')
  const [length, setLength] = useState(30)
  const [energy, setEnergy] = useState<Energy>('Light')
  const [calendar, setCalendar] = useState('personal')
  const [where, setWhere] = useState('')
  const [template, setTemplate] = useState('blank')
  const [habitTime, setHabitTime] = useState('09:00')
  const [habitLen, setHabitLen] = useState(5)
  const [habitDays, setHabitDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

  const projectOptions: Opt[] = (Object.keys(projectInfo) as string[]).map((k) => ({
    value: k,
    label: projectInfo[k].name,
    swatch: projectColor[k]
  }))
  const open = (id: string) => (o: boolean): void => setOpenMenu(o ? id : null)

  /** The grey button next to Create: a task goes to the Inbox for later, a note opens as a full page. */
  const ghostAction = (): void => {
    const text = title.trim()
    if (type === 'task' && text) {
      captureWithAi(text)
      closeNew()
    } else if (type === 'note') create()
    else closeNew()
  }

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
      const base = { ...(hasWords ? parsed : { ...parsed, group, time: when ? when.start : '13:30' }), length: parsed.length ?? length }
      const { task, group: g } = toTask(base as typeof parsed, project)
      // What was picked below wins unless the words in the title already named a project.
      useTasks.getState().add({ ...task, project: parsed.project ?? project, energy }, g)
    } else if (type === 'habit' && text) {
      useHabits.getState().add(text, { time: habitTime, lengthMin: habitLen, days: habitDays.length ? habitDays : [0, 1, 2, 3, 4, 5, 6] })
    } else if (type === 'event' && text) {
      // The design's default when nobody touched the picker: tomorrow 15:00 – 16:00.
      const w = when ?? { day: dayKey(addDays(appToday(), 1)), start: '15:00', end: '16:00' }
      useCalendar.getState().add({
        title: text,
        date: w.day ?? dayKey(appToday()),
        start: w.start,
        end: w.end,
        allDay,
        kind: calendar as 'personal' | 'work' | 'acc',
        ...(where.trim() ? { location: where.trim() } : null),
        rrule: REPEATS[repeat].rule
      })
    } else if (type === 'note' && text) {
      const tpl = noteTemplates.find((t) => t.id === template)
      const chip = { color: projectColor[project], name: projectInfo[project].name }
      noteId = useNotes.getState().add(text, { chip, ...(tpl && tpl.sections.length ? { text: templateText(tpl.sections) } : null) })
    }
    closeNew()
    if (noteId) navigate(`/notes/${noteId}`)
  }

  return (
    <Overlay onClose={openMenu ? () => setOpenMenu(null) : pickerOpen ? () => setPickerOpen(false) : closeNew}>
      <div
        className="np"
        onMouseDown={() => openMenu && setOpenMenu(null)}
        onKeyDown={(e) => {
          // Enter on a button or in a time box does what that control does; elsewhere it creates.
          const tag = (e.target as HTMLElement).tagName
          if (e.key === 'Enter' && !e.shiftKey && tag !== 'BUTTON' && !(e.target as HTMLInputElement).type?.match?.(/time|date/)) {
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
          {(type === 'task' || type === 'event') && (
            <PropRow
              p={(() => {
                const w = c.props[0]
                if (w.kind !== 'when') return w
                if (when) return { ...w, text: formatWhen(when) }
                // The suggested slot follows the chosen length
                return type === 'task' ? { ...w, text: `Today, 13:30 – ${plusMin('13:30', length)}` } : w
              })()}
              i={0}
              last={false}
              onWhen={() => setPickerOpen(true)}
            />
          )}
          {type === 'task' && (
            <>
              <SelectField label="Project" value={project} options={projectOptions} onChange={setProject} open={openMenu === 'project'} onOpen={open('project')} />
              <SelectField label="Length" value={String(length)} options={(LENGTHS.includes(length) ? LENGTHS : [...LENGTHS, length].sort((a, b) => a - b)).map((n) => ({ value: String(n), label: lenLabel(n) }))} onChange={(v) => {
                const n = Number(v)
                setLength(n)
                // A chosen time keeps its start; its end follows the length
                if (when) setWhen({ ...when, end: plusMin(when.start, n) })
              }} open={openMenu === 'length'} onOpen={open('length')} />
              <SelectField label="Energy" value={energy} options={[{ value: 'Light', label: 'Light' }, { value: 'Deep focus', label: 'Deep focus' }]} onChange={(v) => setEnergy(v as Energy)} open={openMenu === 'energy'} onOpen={open('energy')} last />
            </>
          )}
          {type === 'event' && (
            <>
              <SelectField label="Calendar" value={calendar} options={CALENDARS} onChange={setCalendar} open={openMenu === 'calendar'} onOpen={open('calendar')} />
              <TextField label="Where" value={where} onChange={setWhere} placeholder="Add a place or a Meet link" />
              <SwitchField label="All day" text={allDay ? 'Yes' : 'No'} on={allDay} onChange={setAllDay} />
              <SelectField label="Repeat" value={String(repeat)} options={REPEATS.map((r, n) => ({ value: String(n), label: r.label }))} onChange={(v) => setRepeat(Number(v))} open={openMenu === 'repeat'} onOpen={open('repeat')} last />
            </>
          )}
          {type === 'note' && (
            <>
              <SelectField label="Project" value={project} options={projectOptions} onChange={setProject} open={openMenu === 'project'} onOpen={open('project')} top />
              <SelectField label="Template" value={template} options={noteTemplates.map((t) => ({ value: t.id, label: t.label }))} onChange={setTemplate} open={openMenu === 'template'} onOpen={open('template')} last />
            </>
          )}
          {type === 'habit' && (
            <>
              <DaysField label="Repeat" days={habitDays} onChange={setHabitDays} top />
              <TimeField label="Time" value={habitTime} onChange={setHabitTime} />
              <SelectField label="Length" value={String(habitLen)} options={[1, 2, 5, 10, 15, 20, 30, 45, 60].map((n) => ({ value: String(n), label: lenLabel(n) }))} onChange={(v) => setHabitLen(Number(v))} open={openMenu === 'hlen'} onOpen={open('hlen')} last />
            </>
          )}
        </div>

        {pickerOpen && (
          <DatePicker
            value={
              when ??
              (type === 'event'
                ? { day: dayKey(addDays(appToday(), 1)), start: '15:00', end: '16:00' }
                : { day: dayKey(appToday()), start: '13:30', end: plusMin('13:30', length) })
            }
            onChange={(w) => {
              setWhen(w)
              // The picker's times set the length, so the two always agree
              const d = toMin(w.end) - toMin(w.start)
              if (type === 'task' && d > 0) setLength(d)
            }}
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
            <button className="row" style={{ height: 36, padding: '0 8px' }} onClick={ghostAction}>
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
 