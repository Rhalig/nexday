import { Icon } from '../../components/Icon'
import { projectColor } from '../../components/ui'
import { projects, type Project } from '../../data/tasks'

export type PlanTaskLike = { title: string; project: Project; time: string; done?: boolean; hot?: boolean }
export type PlanGroupLike = { id: string; title: string; link?: { label: string }; tasks: PlanTaskLike[] }

const doneAt: Record<string, string> = {
  'Finish onboarding flow wireframes': '8:40',
  'Clean up user interview notes': '9:25',
  'Send the prototype link to Ece': '10:02',
  'Get a quote from the moving company': '10:30'
}
const hints: Record<string, string> = { anytime: 'Before book club' }

const Meta = ({ project, right, hot, mono }: { project: Project; right: string; hot?: boolean; mono?: boolean }): React.JSX.Element => (
  <div className="m">
    <div className="swatch" style={{ background: projectColor[project], width: 10, height: 10, borderRadius: 3 }} />
    {projects[project].name}
    <span className={mono ? 'r mono' : 'r'} style={hot ? { color: 'var(--acc-text)', fontWeight: 500 } : undefined}>
      {right}
    </span>
  </div>
)

export function TodayBoard({ plan, onOpen }: { plan: PlanGroupLike[]; onOpen: (title: string) => void }): React.JSX.Element {
  const done = plan.flatMap((g) => g.tasks.filter((t) => t.done))
  return (
    <div className="tv-board">
      {plan.map((g) => {
        const open = g.tasks.filter((t) => !t.done)
        return (
          <div className="tv-col" key={g.id}>
            <div className="tv-colh">
              <span>{g.title}</span>
              <span className="n">{open.length}</span>
              {(g.link?.label ?? hints[g.id]) && <span className="hint">{g.link?.label ?? hints[g.id]}</span>}
            </div>
            {open.map((t) => (
              <div className="tv-card" key={t.title} onClick={() => onOpen(t.title)}>
                <span className="t">{t.title}</span>
                <Meta project={t.project} right={t.time} hot={t.hot} mono />
              </div>
            ))}
            <div className="tv-add">
              <Icon name="plus" size={14} strokeWidth={2} />
              Add task
            </div>
          </div>
        )
      })}
      <div className="tv-col">
        <div className="tv-colh">
          <span>Done</span>
          <span className="n">{done.length}</span>
        </div>
        {done.map((t) => (
          <div className="tv-card done" key={t.title}>
            <span className="t">{t.title}</span>
            <Meta project={t.project} right={doneAt[t.title] ?? ''} />
          </div>
        ))}
      </div>
    </div>
  )
}

const hoursLabels = Array.from({ length: 16 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`)

type Ev = { cls: string; top: number; h: number; title: string; sub?: string; chip?: string }

const events: Ev[] = [
  { cls: 'h', top: 2, h: 40, title: 'Run', sub: '07:00 – 08:00' },
  { cls: 'mv', top: 90, h: 84, title: 'Deep work · Onboarding', sub: '09:00 – 11:00 · moved by Nexday' },
  { cls: 'w', top: 200, h: 40, title: 'Product sync', sub: '11:30 – 12:30' },
  { cls: 'w', top: 354, h: 62, title: 'Design critique', sub: '15:00 – 16:30' },
  { cls: 'mv', top: 442, h: 40, title: 'Pitch draft', sub: '17:00 – 18:00 · moved' },
  { cls: 'p', top: 552, h: 40, title: 'Book club', sub: '19:30 – 20:30' }
]

export function TodayCalendar(): React.JSX.Element {
  return (
    <div className="tv-cal">
      <div className="tv-time">
        <div className="col" style={{ width: 48, flex: 'none' }}>
          {hoursLabels.map((h) => (
            <div className="tv-hl" key={h}>
              {h}
            </div>
          ))}
        </div>
        <div className="tv-grid">
          {events.map((e) => (
            <div className={`tv-ev ${e.cls}`} key={e.title} style={{ top: e.top, height: e.h }}>
              <b>{e.title}</b>
              <i>{e.sub}</i>
            </div>
          ))}
          <div className="tv-ev" style={{ top: 266, height: 84, border: '1px dashed #CBCBC8', color: 'var(--ink3)', flexDirection: 'row', gap: 12, padding: '10px 14px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Free · 2h</span>
            <span style={{ fontSize: 12, color: 'var(--acc-text)', fontWeight: 500 }}>Fill the gap</span>
          </div>
          <div className="tv-ev chip" style={{ top: 330, borderLeftColor: 'var(--acc)' }}>
            <b>Prepare 3 home screen variations · 14:30</b>
          </div>
          <div className="tv-ev chip" style={{ top: 484, borderLeftColor: 'var(--personal)' }}>
            <b>Finish chapter 4 for book club · 18:00</b>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 162, height: 2, background: 'var(--acc)', borderRadius: 1 }}>
            <span style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--acc)' }} />
            <span style={{ position: 'absolute', right: 0, top: -18, fontSize: 11, color: 'var(--acc-text)', fontWeight: 500 }}>10:40</span>
          </div>
          <div style={{ position: 'absolute', right: 0, top: 420, width: 3, height: 66, borderRadius: 2, background: 'var(--acc)', opacity: 0.35 }} />
        </div>
      </div>
      <div className="col" style={{ width: 300, flex: 'none' }}>
        <div className="row" style={{ paddingBottom: 8, borderBottom: '1px solid var(--line2)' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Unscheduled</span>
          <span className="muted" style={{ fontSize: 12.5, marginLeft: 8 }}>
            0
          </span>
        </div>
        <div className="tv-ur">
          <span className="muted" style={{ fontSize: 13 }}>
            Every task for today is on the timeline.
          </span>
        </div>
        <div className="row" style={{ gap: 8, paddingTop: 16, alignItems: 'flex-start' }}>
          <span style={{ color: '#E2680C', display: 'flex', marginTop: 2 }}>
            <Icon name="bolt" size={14} strokeWidth={2} />
          </span>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Drag a task on the timeline to move it. Your energy picks up 16:30 – 18:00.
          </span>
        </div>
      </div>
    </div>
  )
}
