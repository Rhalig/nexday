import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { useEscape } from './Popups'
import { ConfirmDialog } from './DrawerParts'
import { Button, Kbd, cn, projectColor } from './ui'
import { projects as taskProjects, type Project } from '../data/tasks'
import { useProjects } from '../store/projects'
import { useTasks } from '../store/tasks'
import { useHabits } from '../store/habits'
import { useCalendar } from '../store/calendar'
import { useUI } from '../store/ui'
import { useInbox } from '../store/inbox'
import { useNotes } from '../store/notes'
import { deleteAccount } from '../lib/account'
import { toStoreTask, type ParsedImport } from '../lib/dataPorter'
import { PLAN_HORIZON, planDayLabel, planTasks } from '../lib/planning'
import { appToday } from '../lib/clock'
import './dialogs.css'
import { useIdentity } from '../lib/identity'

/** Scrim + centred box. `top` is the distance from the window top, as in the designs. */
export function Modal({
  top,
  width,
  onClose,
  children,
  style
}: {
  top: number
  width: number
  onClose: () => void
  children: ReactNode
  style?: React.CSSProperties
}): React.JSX.Element {
  useEscape(onClose)
  return (
    <div className="dl-scrim" style={{ paddingTop: top }} onMouseDown={onClose}>
      <div className="dl-box" style={{ width, ...style }} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function Header({
  title,
  sub,
  onClose,
  titleSize = 19
}: {
  title: ReactNode
  sub?: string
  onClose: () => void
  titleSize?: number
}): React.JSX.Element {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div className="col">
        <span style={{ fontSize: titleSize, fontWeight: 500 }}>{title}</span>
        {sub && <span style={{ fontSize: 13, color: '#6B6B6B' }}>{sub}</span>}
      </div>
      <button className="dl-x" aria-label="Close" onClick={onClose}>
        <Icon name="x" strokeWidth={1.9} />
      </button>
    </div>
  )
}

function Toggle2({
  on,
  onChange
}: {
  on: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <button
      className={cn('dl-tg', !on && 'off')}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  )
}


/* ---------------- Delete account ---------------- */

export function DeleteAccountDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEscape(() => {
    if (!busy) onClose()
  })
  const ready = text.trim() === 'DELETE' && !busy

  const go = async (): Promise<void> => {
    if (!ready) return
    setBusy(true)
    setErr(null)
    const r = await deleteAccount()
    // On success the app signs out and leaves this screen by itself.
    if (r.error) {
      setErr(r.error)
      setBusy(false)
    }
  }

  return (
    <Modal top={170} width={520} onClose={() => (busy ? undefined : onClose())}>
      <Header
        title="Delete your account?"
        sub="This permanently removes your account and everything in it."
        onClose={() => (busy ? undefined : onClose())}
      />
      <div style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.55, color: '#4A4A4A' }}>
        Your tasks, notes, habits, events, projects and settings are deleted from our servers. A paid
        plan is cancelled first. This cannot be undone. Events already added to Mac Calendar stay
        there.
      </div>
      <div className="col" style={{ marginTop: 18, gap: 6 }}>
        <span style={{ fontSize: 12.5, color: '#6B6B6B' }}>Type DELETE to confirm</span>
        <input
          autoFocus
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void go()
          }}
          placeholder="DELETE"
          style={{
            height: 40,
            border: '1px solid #E0E0DD',
            borderRadius: 10,
            padding: '0 12px',
            font: 'inherit',
            outline: 'none'
          }}
        />
      </div>
      {err && <div style={{ marginTop: 12, fontSize: 13, color: '#C2362B' }}>{err}</div>}
      <div className="dl-foot" style={{ marginTop: 20, paddingTop: 18 }}>
        <span />
        <div className="row" style={{ gap: 10 }}>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void go()}
            disabled={!ready}
            style={ready ? undefined : { opacity: 0.45, cursor: 'default' }}
          >
            {busy ? 'Deleting…' : 'Delete account'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- Import tasks ---------------- */

export function ImportDialog({
  parsed,
  onClose
}: {
  parsed: ParsedImport
  onClose: () => void
}): React.JSX.Element {
  const groups = useTasks((s) => s.groups)
  const plan = useUI((s) => s.planning)
  const [done, setDone] = useState<number | null>(null)
  useEscape(onClose)

  // Tasks already open in Nexday (same title) and repeats inside the file are left out.
  const seen = new Set(groups.flatMap((g) => g.tasks.map((t) => t.title.trim().toLowerCase())))
  const fresh = parsed.tasks.filter((t) => {
    const k = t.title.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const dupes = parsed.tasks.length - fresh.length
  const withTime = fresh.filter((t) => toStoreTask(t, plan.defaultLength).group !== 'no-time').length

  const confirm = (): void => {
    useTasks.getState().addMany(fresh.map((t) => toStoreTask(t, plan.defaultLength)))
    setDone(fresh.length)
  }

  return (
    <Modal top={170} width={520} onClose={onClose}>
      <Header
        title={done === null ? 'Import tasks' : 'Import finished'}
        sub={`From ${parsed.source}`}
        onClose={onClose}
      />
      <div style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.6, color: '#4A4A4A' }}>
        {done === null ? (
          <>
            <b>{fresh.length}</b> {fresh.length === 1 ? 'task' : 'tasks'} will be added.
            {withTime > 0 && ` ${withTime} ${withTime === 1 ? 'keeps its' : 'keep their'} time; the rest wait in "No time yet" for Auto-schedule.`}
            {withTime === 0 && ' They wait in "No time yet" for Auto-schedule.'}
            {dupes > 0 && ` ${dupes} already in Nexday or repeated, skipped.`}
            {parsed.ignored > 0 && ` ${parsed.ignored} done or non-task ${parsed.ignored === 1 ? 'entry' : 'entries'} ignored.`}
          </>
        ) : (
          <>
            Added <b>{done}</b> {done === 1 ? 'task' : 'tasks'}. They are saving to your account now.
          </>
        )}
      </div>
      <div className="dl-foot" style={{ marginTop: 20, paddingTop: 18 }}>
        <span />
        <div className="row" style={{ gap: 10 }}>
          {done === null ? (
            <>
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="dark" onClick={confirm} disabled={fresh.length === 0}>
                Import {fresh.length}
              </Button>
            </>
          ) : (
            <Button variant="dark" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- Auto-schedule preview ---------------- */

export function AutoScheduleDialog(): React.JSX.Element {
  const closeDialog = useUI((s) => s.closeDialog)
  const plan = useUI((s) => s.planning)
  const groups = useTasks((s) => s.groups)
  const schedule = useTasks((s) => s.schedule)
  const events = useCalendar((s) => s.events)
  const habits = useHabits((s) => s.habits)
  const projectPrefs = useUI((s) => s.projectPrefs)
  // Projects with auto-schedule switched off keep their tasks where they are.
  const open = (groups.find((g) => g.id === 'no-time')?.tasks ?? []).filter((t) => projectPrefs[t.project]?.auto !== false)
  const [off, setOff] = useState<Record<string, boolean>>({})
  const [useEnergy, setUseEnergy] = useState(plan.useEnergy)
  const [bufferOn, setBufferOn] = useState(plan.buffer > 0)

  // Make sure the plan sees this week's real events, wherever the calendar was left.
  useEffect(() => {
    void useCalendar.getState().loadSpan(appToday(), PLAN_HORIZON + 1)
  }, [])

  const result = planTasks(
    open,
    groups,
    events,
    { ...plan, useEnergy, buffer: bufferOn ? plan.buffer : 0 },
    plan.reserveHabits ? habits.map((h) => ({ time: h.time, length: h.length })) : []
  )
  const pending = result.placements
  const days = new Set(pending.map((p) => p.date)).size
  const spread = days > 1 ? ` over ${days} days, starting ${planDayLabel(result.date)}` : ` ${planDayLabel(result.date)}`
  const chosen = pending.filter((t) => !off[t.id])

  const confirm = (): void => {
    schedule(chosen.map((t) => ({ id: t.id, group: t.group, time: t.time })))
    closeDialog()
  }

  return (
    <Modal top={190} width={680} onClose={closeDialog}>
      <Header
        title={`Auto-schedule ${pending.length} ${pending.length === 1 ? 'task' : 'tasks'}`}
        sub={
          open.length === 0
            ? 'Every open task already has a time.'
            : `Nexday found ${pending.length} open ${pending.length === 1 ? 'slot' : 'slots'}${spread}. Nothing is placed until you confirm.`
        }
        onClose={closeDialog}
      />
      <div className="col" style={{ marginTop: 18, borderTop: '1px solid #EDEDEB' }}>
        {pending.length === 0 && (
          <div style={{ padding: '24px 0', color: '#6B6B6B' }}>
            {open.length === 0
              ? 'Every open task already has a time.'
              : `No open slot was long enough in the next ${PLAN_HORIZON} days (${open.length} task${open.length === 1 ? '' : 's'} left).`}
          </div>
        )}
        {pending.map((t) => {
          const on = !off[t.id]
          return (
            <div className="dl-it" key={t.id}>
              <button
                className={cn('dl-ck', !on && 'off')}
                aria-label="Include"
                onClick={() => setOff({ ...off, [t.id]: on })}
              >
                {on && <Icon name="check" size={11} strokeWidth={3.2} />}
              </button>
              <div className="col" style={{ flex: 1, lineHeight: 1.35 }}>
                <span style={{ fontWeight: 500 }}>{t.title}</span>
                <span className="row" style={{ gap: 8, fontSize: 12.5, color: '#6B6B6B' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 3,
                      background: projectColor[t.project]
                    }}
                  />
                  {taskProjects[t.project].name} · {t.energy} · {t.lengthMin}m
                </span>
              </div>
              <span style={{ color: '#A0A09E', display: 'flex' }}>
                <Icon name="arrowRight" size={16} />
              </span>
              <div className="col" style={{ width: 190, lineHeight: 1.35 }}>
                <span style={{ fontWeight: 500 }}>{t.when}</span>
                <span style={{ fontSize: 12.5, color: '#6B6B6B' }}>{t.note}</span>
              </div>
              <button style={{ fontSize: 13, color: '#6B6B6B' }}>Change</button>
            </div>
          )
        })}
      </div>
      <div className="col" style={{ padding: '6px 0 4px' }}>
        <div
          className="row"
          style={{ gap: 12, padding: '12px 0', borderBottom: '1px solid #EDEDEB' }}
        >
          <div className="col" style={{ flex: 1, lineHeight: 1.35 }}>
            <span style={{ fontSize: 13.5 }}>Use my energy curve</span>
            <span style={{ fontSize: 12.5, color: '#6B6B6B' }}>
              Deep work goes in the morning, light work after 12:00.
            </span>
          </div>
          <Toggle2 on={useEnergy} onChange={setUseEnergy} />
        </div>
        <div className="row" style={{ gap: 12, padding: '12px 0' }}>
          <div className="col" style={{ flex: 1, lineHeight: 1.35 }}>
            <span style={{ fontSize: 13.5 }}>Add buffer between items</span>
            <span style={{ fontSize: 12.5, color: '#6B6B6B' }}>
              {plan.buffer
                ? `${plan.buffer} minutes around meetings and tasks.`
                : 'No buffer around meetings or tasks.'}
            </span>
          </div>
          <Toggle2 on={bufferOn} onChange={setBufferOn} />
        </div>
      </div>
      <div className="dl-foot" style={{ marginTop: 6, paddingTop: 18 }}>
        <div className="row" style={{ gap: 8 }}>
          <Kbd>esc</Kbd>
          <span style={{ fontSize: 12, color: '#6B6B6B' }}>Close</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="dark" onClick={confirm} style={{ opacity: chosen.length ? 1 : 0.5 }}>
            Schedule {chosen.length} {chosen.length === 1 ? 'task' : 'tasks'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- Inbox sources & rules ---------------- */

const sources: Array<{ icon: IconName; name: string; sub: string; static?: string }> = [
  {
    icon: 'plus',
    name: 'Quick capture',
    sub: 'Anything you type with ⌘K · always on'
  },
  { icon: 'mail', name: 'Email', sub: 'Starred emails · coming soon', static: 'Soon' },
  { icon: 'hash', name: 'Slack mentions', sub: 'Mentions and direct messages · coming soon', static: 'Soon' },
  { icon: 'git', name: 'GitHub reviews', sub: 'Review requests · coming soon', static: 'Soon' }
]
export function InboxRulesDialog(): React.JSX.Element {
  const closeDialog = useUI((s) => s.closeDialog)
  const waiting = useInbox((st) => st.items.filter((i) => i.source === 'capture').length)

  return (
    <Modal top={80} width={680} onClose={closeDialog}>
      <Header
        title="Inbox sources"
        sub="Choose what lands in your Inbox."
        onClose={closeDialog}
      />
      <div className="dl-lb" style={{ paddingTop: 20 }}>
        <span>Sources</span>
      </div>
      <div className="col" style={{ borderTop: '1px solid #EDEDEB' }}>
        {sources.map((s, i) => (
          <div className="dl-s" key={s.name}>
            <div className="dl-ic">
              <Icon name={s.icon} size={15} />
            </div>
            <div className="t">
              <b>{s.name}</b>
              <i>{s.sub}</i>
            </div>
            <span style={{ fontSize: 12, color: '#767676' }}>
              {i === 0 ? `${waiting} waiting` : s.static}
            </span>
          </div>
        ))}
      </div>
      <div className="dl-lb">
        <span>Rules</span>
      </div>
      <div style={{ padding: '4px 0 12px', fontSize: 13, color: '#767676' }}>
        Rules for filing email, Slack and GitHub items arrive together with those sources.
      </div>
      <div className="dl-foot" style={{ marginTop: 8, paddingTop: 18 }}>
        <span />
        <div className="row" style={{ gap: 10 }}>
          <Kbd>esc</Kbd>
          <Button variant="dark" onClick={closeDialog}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- Note templates ---------------- */

const templates: Array<{
  id: string
  label: string
  icon: IconName
  desc: string
  sections: Array<[string, string]>
}> = [
  {
    id: 'blank',
    label: 'Blank note',
    icon: 'file',
    desc: 'Start with an empty page and press / for commands.',
    sections: []
  },
  {
    id: 'meeting',
    label: 'Meeting notes',
    icon: 'calendar',
    desc: 'Linked to the calendar event you pick. Attendees are filled in for you.',
    sections: [
      ['Attendees', 'Names from the event'],
      ['Agenda', 'What this meeting is for'],
      ['Notes', 'Decisions, numbers, open questions'],
      ['Action items', 'Nexday turns these into tasks']
    ]
  },
  {
    id: 'one',
    label: '1:1',
    icon: 'share',
    desc: 'A running page for one person, carried from week to week.',
    sections: [
      ['Check-in', 'How things are going'],
      ['Topics', 'What to cover this time'],
      ['Action items', 'Nexday turns these into tasks']
    ]
  },
  {
    id: 'critique',
    label: 'Design critique',
    icon: 'checkCircle',
    desc: 'Frame the feedback you want before the session starts.',
    sections: [
      ['Goal', 'What you are showing'],
      ['Questions', 'What to ask the room'],
      ['Feedback', 'What people said'],
      ['Next steps', 'Changes to make']
    ]
  },
  {
    id: 'brief',
    label: 'Project brief',
    icon: 'lines',
    desc: 'One page that explains a project to someone new.',
    sections: [
      ['Problem', 'What we are solving'],
      ['Scope', 'What is in and out'],
      ['Milestones', 'Dates that matter']
    ]
  },
  {
    id: 'reading',
    label: 'Reading notes',
    icon: 'book',
    desc: 'Keep what you read and what it made you think.',
    sections: [
      ['Highlights', 'Lines worth keeping'],
      ['Ideas', 'What it made you think of'],
      ['Questions', 'To bring to book club']
    ]
  },
  {
    id: 'journal',
    label: 'Daily journal',
    icon: 'sunSm',
    desc: 'A few minutes at the end of the day.',
    sections: [
      ['Wins', 'What went well'],
      ['Hard parts', 'What got in the way'],
      ['Tomorrow', 'One thing to start with']
    ]
  }
]

export function TemplatesDialog(): React.JSX.Element {
  const navigate = useNavigate()
  const closeDialog = useUI((s) => s.closeDialog)
  const [sel, setSel] = useState('meeting')
  const t = templates.find((x) => x.id === sel) ?? templates[1]

  return (
    <Modal
      top={150}
      width={800}
      onClose={closeDialog}
      style={{ padding: 0, height: 620, overflow: 'hidden', marginBottom: 0 }}
    >
      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: 24,
          borderBottom: '1px solid #EDEDEB'
        }}
      >
        <div className="col">
          <span style={{ fontSize: 19, fontWeight: 500 }}>Start from a template</span>
          <span style={{ fontSize: 13, color: '#6B6B6B' }}>
            Templates come with sections, and Nexday picks action items out of the ones you write.
          </span>
        </div>
        <button className="dl-x" aria-label="Close" onClick={closeDialog}>
          <Icon name="x" strokeWidth={1.9} />
        </button>
      </div>
      <div className="row" style={{ flex: 1, alignItems: 'stretch', minHeight: 0 }}>
        <div
          className="col"
          style={{
            width: 270,
            flex: 'none',
            padding: '12px 10px',
            borderRight: '1px solid #EDEDEB',
            gap: 2
          }}
        >
          {templates.map((x) => (
            <button
              key={x.id}
              className={cn('dl-tp', x.id === sel && 'on')}
              onClick={() => setSel(x.id)}
            >
              <Icon name={x.icon} />
              {x.label}
            </button>
          ))}
        </div>
        <div className="col" style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <span style={{ fontSize: 12, color: '#767676' }}>Preview</span>
          <span style={{ fontSize: 22, fontWeight: 500, marginTop: 2 }}>{t.label}</span>
          <span style={{ fontSize: 13, color: '#6B6B6B' }}>{t.desc}</span>
          <div className="col" style={{ marginTop: 10, borderTop: '1px solid #EDEDEB' }}>
            {t.sections.map(([h, l], i) => (
              <div className="col" key={h}>
                <span className="dl-sh">{h}</span>
                <span
                  className="dl-ln"
                  style={i === t.sections.length - 1 ? { borderBottom: 0 } : undefined}
                >
                  {l}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="dl-foot" style={{ padding: '16px 24px' }}>
        <div className="row" style={{ gap: 8 }}>
          <Kbd>esc</Kbd>
          <span style={{ fontSize: 12, color: '#6B6B6B' }}>Close</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="dark"
            onClick={() => {
              // A new note with the template's sections as headings, action-item sections ready to type into.
              const id = useNotes.getState().add(t.id === 'blank' ? 'Untitled note' : t.label)
              const body = t.sections
                .map(([h]) => `# ${h}\n${/action items|next steps/i.test(h) ? '[ ] ' : ''}`)
                .join('\n')
              if (body) useNotes.getState().update(id, { text: body })
              closeDialog()
              navigate(`/notes/${id}`)
            }}
          >
            Use template
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- Project settings & Share ---------------- */

const palette = ['#F38020', '#5B6578', '#2E8B57', '#A4505A', '#4A78D4', '#C79A2B', '#1A1A1A']
const hexOf: Record<string, string> = {
  'var(--acc)': '#F38020',
  'var(--work)': '#5B6578',
  'var(--personal)': '#A4505A',
  'var(--health)': '#2E8B57'
}

const BASE_SLUGS: Record<string, Project> = {
  'planner-mvp': 'planner',
  'moving-house': 'moving',
  'reading-list': 'reading'
}

function useProject(slug?: string): { name: string; color: string; description: string } {
  const custom = useProjects((s) => s.custom.find((c) => c.slug === slug))
  const baseKey = slug ? BASE_SLUGS[slug] : undefined
  if (baseKey) {
    return { name: taskProjects[baseKey].name, color: hexOf[projectColor[baseKey]] ?? '#F38020', description: '' }
  }
  return { name: custom?.name ?? 'Project', color: custom?.color ?? '#F38020', description: custom?.description ?? '' }
}

export function ProjectSettingsDialog({ slug }: { slug?: string }): React.JSX.Element {
  const closeDialog = useUI((s) => s.closeDialog)
  const navigate = useNavigate()
  const p = useProject(slug)
  const builtinKey = slug ? BASE_SLUGS[slug] : undefined
  const key = builtinKey ?? slug ?? ''
  const custom = useProjects((s) => s.custom.find((c) => c.slug === slug))
  const pref = useUI((s) => s.projectPrefs[key])
  const [name, setName] = useState(p.name)
  const [desc, setDesc] = useState(custom?.description ?? pref?.description ?? '')
  const [color, setColor] = useState(p.color)
  const [auto, setAuto] = useState(pref?.auto !== false)
  const [side, setSide] = useState(pref?.sidebar !== false)
  const [confirmDel, setConfirmDel] = useState(false)
  useEscape(closeDialog)

  const save = (): void => {
    const n = name.trim()
    useUI.getState().setProjectPref(key, { auto, sidebar: side, ...(builtinKey ? { description: desc } : null) })
    if (custom && n) useProjects.getState().update(custom.slug, { name: n, color, description: desc })
    closeDialog()
  }

  const remove = (): void => {
    if (!custom) return
    // Its open tasks move to Personal rather than disappear.
    for (const g of useTasks.getState().groups)
      for (const t of g.tasks) if (t.project === custom.slug) useTasks.getState().patch(t.id, { project: 'personal' })
    useProjects.getState().remove(custom.slug)
    closeDialog()
    navigate('/tasks')
  }

  return (
    <Modal top={130} width={600} onClose={closeDialog}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          <span style={{ fontSize: 18, fontWeight: 500 }}>Project settings</span>
        </div>
        <button className="dl-x" aria-label="Close" onClick={closeDialog}>
          <Icon name="x" strokeWidth={1.9} />
        </button>
      </div>
      <div className="col" style={{ marginTop: 14, borderTop: '1px solid #EDEDEB' }}>
        <div className="dl-pr">
          <span className="dl-pl">Name</span>
          <input
            className="dl-field"
            style={{ fontWeight: 500 }}
            value={name}
            disabled={!custom}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="dl-pr" style={{ alignItems: 'flex-start', padding: '12px 0' }}>
          <span className="dl-pl">Description</span>
          <textarea
            className="dl-field"
            style={{ color: '#2A2A2A', lineHeight: 1.5, resize: 'none', height: 42 }}
            placeholder="Add a description"
            value={desc}
            maxLength={300}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div className="dl-pr">
          <span className="dl-pl">Color</span>
          <div className="row" style={{ gap: 10, opacity: custom ? 1 : 0.45 }}>
            {palette.map((c) => (
              <button
                key={c}
                className={cn('dl-sw', c === color && 'on')}
                style={{ background: c }}
                aria-label={c}
                disabled={!custom}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="dl-pr">
          <span className="dl-pl">Auto-schedule</span>
          <span style={{ fontSize: 14, flex: 1 }}>Place tasks from this project in my free time</span>
          <Toggle2 on={auto} onChange={setAuto} />
        </div>
        <div className="dl-pr">
          <span className="dl-pl">In sidebar</span>
          <span style={{ fontSize: 14, flex: 1 }}>Show {name || p.name} under Projects</span>
          <Toggle2 on={side} onChange={setSide} />
        </div>
        <div className="dl-pr">
          <span className="dl-pl">Danger zone</span>
          {custom ? (
            <button style={{ padding: 0, fontSize: 14, color: '#C2362B' }} onClick={() => setConfirmDel(true)}>
              Delete project
            </button>
          ) : (
            <span style={{ fontSize: 13.5, color: 'var(--ink3)' }}>Built-in projects cannot be deleted. Hide it from the sidebar instead.</span>
          )}
        </div>
      </div>
      <div className="dl-foot" style={{ marginTop: 12, paddingTop: 16 }}>
        <div className="row" style={{ gap: 6 }}>
          <Kbd>esc</Kbd>
          <span style={{ fontSize: 12, color: '#6B6B6B' }}>Close</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="dark" onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
      {confirmDel && (
        <ConfirmDialog
          title="Delete this project?"
          body={<>“{name || p.name}” will be removed. Its open tasks move to Personal.</>}
          confirmLabel="Delete project"
          onConfirm={remove}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </Modal>
  )
}

type Member = {
  name: string
  email: string
  letter: string
  color: string
  role: string
  pending?: boolean
  owner?: boolean
}

export function ShareDialog({ slug }: { slug?: string }): React.JSX.Element {
  const who = useIdentity()
  const closeDialog = useUI((s) => s.closeDialog)
  const p = useProject(slug)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'Can edit' | 'Can view'>('Can edit')
  const [link, setLink] = useState(false)
  const [members, setMembers] = useState<Member[]>([
    {
      name: who.name,
      email: who.email,
      letter: who.initial,
      color: '#1A1A1A',
      role: 'Owner',
      owner: true
    }
  ])

  const invite = (): void => {
    const e = email.trim()
    if (!e.includes('@')) return
    setMembers([
      ...members,
      {
        name: e,
        email: 'Invite sent · waiting',
        letter: e[0].toUpperCase(),
        color: '#fff',
        role,
        pending: true
      }
    ])
    setEmail('')
  }

  return (
    <Modal top={150} width={600} onClose={closeDialog}>
      <Header
        title={`Share ${p.name}`}
        sub="People you add can see and plan tasks in this project."
        onClose={closeDialog}
        titleSize={18}
      />
      <div className="row" style={{ gap: 10, marginTop: 18 }}>
        <input
          className="dl-input"
          placeholder="Add people by email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invite()}
        />
        <button
          className="row"
          style={{
            gap: 6,
            height: 40,
            padding: '0 12px',
            borderRadius: 10,
            border: '1px solid #E2E2E0'
          }}
          onClick={() => setRole(role === 'Can edit' ? 'Can view' : 'Can edit')}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>{role}</span>
          <span style={{ color: '#767676', display: 'flex' }}>
            <Icon name="chevronDown" size={14} strokeWidth={2} />
          </span>
        </button>
        <Button variant="dark" style={{ height: 40 }} onClick={invite}>
          Invite
        </Button>
      </div>
      <div className="col" style={{ marginTop: 18, borderTop: '1px solid #EDEDEB' }}>
        {members.map((m) => (
          <div className="dl-mr" key={m.email + m.name}>
            <div
              className="dl-av"
              style={
                m.pending
                  ? { background: '#fff', border: '1.5px dashed #BDBDBA', color: '#767676' }
                  : { background: m.color }
              }
            >
              {m.letter}
            </div>
            <div className="col" style={{ flex: 1, lineHeight: 1.3 }}>
              <span style={{ fontWeight: 500 }}>
                {m.name}
                {m.owner && <span style={{ color: '#767676', fontWeight: 400 }}> (you)</span>}
              </span>
              <span style={{ fontSize: 12.5, color: m.pending ? '#B4500A' : '#6B6B6B' }}>
                {m.email}
              </span>
            </div>
            <span className="dl-role">
              {m.role}
              {!m.owner && (
                <span style={{ color: '#767676', display: 'flex' }}>
                  <Icon name="chevronDown" size={14} strokeWidth={2} />
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 12, paddingTop: 16 }}>
        <span style={{ color: '#6B6B6B', display: 'flex' }}>
          <Icon name="link" size={16} />
        </span>
        <div className="col" style={{ flex: 1, lineHeight: 1.3 }}>
          <span style={{ fontWeight: 500 }}>Anyone with the link can view</span>
          <span style={{ fontSize: 12.5, color: '#6B6B6B' }}>
            {link
              ? 'On. Anyone who has the link can open this project.'
              : 'Off. Only people you invite can open this project.'}
          </span>
        </div>
        <Toggle2 on={link} onChange={setLink} />
      </div>
      <div className="dl-foot" style={{ marginTop: 18, paddingTop: 16 }}>
        <Button>
          <Icon name="copy" size={14} />
          <span>Copy link</span>
        </Button>
        <div className="row" style={{ gap: 10 }}>
          <Kbd>esc</Kbd>
          <Button variant="dark" onClick={closeDialog}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
