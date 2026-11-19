import { Icon } from '../../components/Icon'
import { projectColor } from '../../components/ui'
import { projects, type Project } from '../../data/tasks'
import { DAY_END, DAY_START, clock, fmtMin, type PlanGroup, type PlanTask, type TodayData } from '../../lib/today'

const hints: Record<string, string> = {}

const Meta = ({ project, right, hot, mono }: { project: Project; right: string; hot?: boolean; mono?: boolean }): React.JSX.Element => (
  <div className="m">
    <div className="swatch" style={{ background: projectColor[project], width: 10, height: 10, borderRadius: 3 }} />
    {projects[project].name}
    <span className={mono ? 'r mono' : 'r'} style={hot ? { color: 'var(--acc-text)', fontWeight: 500 } : undefined}>
      {right}
    </span>
  </div>
)

export function TodayBoard({ plan, onOpen }: { plan: PlanGroup[]; onOpen: (id: string) => void }): React.JSX.Element {
  const done: PlanTask[] = plan.flatMap((g) => g.tasks.filter((t) => t.done))
  return (
    <div className="tv-board">
      {plan.map((g) => {
        const open = g.tasks.filter((t) => !t.done)
        return (
          <div className="tv-col" key={g.id}>
            <div className="tv-colh">
              <span>{g.title}</span>
              <span className="n">{open.length}</span>
              {(g.link ?? hints[g.id]) && <span className="hint">{g.link ?? hints[g.id]}</span>}
            </div>
            {open.map((t) => (
              <div className="tv-card" key={t.id} onClick={() => onOpen(t.id)}>
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
          <div className="tv-card done" key={t.id}>
            <span className="t">{t.title}</span>
            <Meta project={t.project} right={t.doneAt ?? ''} />
          </div>
        ))}
      </div>
    </div>
  )
}

const hoursLabels = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => `${String(DAY_START / 60 + i).padStart(2, '0')}:00`)
const PX = 44 / 60
const yOf = (min: number): number => (min - DAY_START) * PX + 2
const evClass = { health: 'h', work: 'w', personal: 'p', moved: 'mv', free: '' } as const

export function TodayCalendar({ data, nowMin }: { data: TodayData; nowMin: number }): React.JSX.Element {
  const blocks = data.strip.filter((s) => s.kind !== 'free' && s.end > DAY_START && s.start < DAY_END)
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
          {blocks
            .filter((b) => !b.key.startsWith('t-'))
            .map((e) => (
              <div
                className={`tv-ev ${evClass[e.kind]}`}
                key={e.key}
                style={{ top: yOf(Math.max(e.start, DAY_START)), height: Math.max(22, (e.end - e.start) * PX - 4) }}
              >
                <b>{e.title}</b>
                <i>{e.hint}</i>
              </div>
            ))}
          {data.gaps.map((g) => (
            <div
              className="tv-ev"
              key={`g${g.start}`}
              style={{ top: yOf(g.start), height: (g.end - g.start) * PX - 4, border: '1px dashed #CBCBC8', color: 'var(--ink3)', flexDirection: 'row', gap: 12, padding: '10px 14px', alignItems: 'flex-start', pointerEvents: 'none' }}
            >
              <span style={{ fontSize: 12, fontWeight: 500 }}>Free · {fmtMin(g.end - g.start)}</span>
            </div>
          ))}
          {blocks
            .filter((b) => b.key.startsWith('t-'))
            .map((t) => (
              <div className="tv-ev chip" key={t.key} style={{ top: yOf(Math.max(t.start, DAY_START)), borderLeftColor: 'var(--acc)' }}>
                <b>
                  {t.title} · {clock(t.start)}
                </b>
              </div>
            ))}
          {nowMin >= DAY_START && nowMin <= DAY_END && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: yOf(nowMin), height: 2, background: 'var(--acc)', borderRadius: 1 }}>
              <span style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--acc)' }} />
              <span style={{ position: 'absolute', right: 0, top: -18, fontSize: 11, color: 'var(--acc-text)', fontWeight: 500 }}>{clock(nowMin)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="col" style={{ width: 300, flex: 'none' }}>
        <div className="row" style={{ paddingBottom: 8, borderBottom: '1px solid var(--line2)' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Unscheduled</span>
          <span className="muted" style={{ fontSize: 12.5, marginLeft: 8 }}>
            {data.unscheduled.length}
          </span>
        </div>
        {data.unscheduled.length === 0 ? (
          <div className="tv-ur">
            <span className="muted" style={{ fontSize: 13 }}>
              Every task for today is on the timeline.
            </span>
          </div>
        ) : (
          data.unscheduled.map((t) => (
            <div className="tv-ur" key={t.id}>
              <span style={{ fontSize: 13 }}>{t.title}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
