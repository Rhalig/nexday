import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { QuickCapture } from '../../components/QuickCapture'
import { Icon } from '../../components/Icon'
import { Button, GroupHeader, cn, projectColor } from '../../components/ui'
import { useLeaving } from '../../lib/useLeaving'
import { TaskRow } from '../../components/TaskRow'
import { projects, type Project as ProjectKey, type Task, type TaskGroup } from '../../data/tasks'
import { useUI } from '../../store/ui'
import { useProjects } from '../../store/projects'
import { useTasks, type DoneTask } from '../../store/tasks'
import { loadDoneTasks } from '../../lib/cloud'
import { parseCapture, toTask } from '../../lib/capture'
import { fmtMin, parseTime } from '../../lib/today'
import './projects.css'

const SLUG_KEY: Record<string, ProjectKey> = {
  'planner-mvp': 'planner',
  'moving-house': 'moving',
  'reading-list': 'reading'
}

export default function Project(): React.JSX.Element {
  const { slug } = useParams()
  const custom = useProjects((s) => s.custom.find((c) => c.slug === slug))
  const key = slug ? SLUG_KEY[slug] : undefined
  // Re-render when the colour is changed in Project settings
  useUI((s) => (key ? s.projectPrefs[key]?.color : undefined))
  if (key) return <ProjectView key={slug} slug={slug!} name={projects[key].name} color={projectColor[key]} projectKey={key} />
  if (custom)
    return <ProjectView key={custom.slug} slug={custom.slug} name={custom.name} color={custom.color} projectKey={custom.slug} />
  return <Navigate to="/projects/planner-mvp" replace />
}

/** An open task in a project: ticking it slides it out, then it moves to Done. */
function OpenRow({ task: t, onOpen, onDone }: { task: Task; onOpen: () => void; onDone: () => void }): React.JSX.Element {
  const { leaving, toggle } = useLeaving(onDone)
  const back = useTasks((s) => s.reopened.includes(t.id))
  return (
    <div className={cn('pj-t', !!leaving && 'leaving', back && 'enter-up')} onClick={onOpen}>
      <button
        className={cn('pj-cb', !!leaving && 'on')}
        aria-label="Complete"
        onClick={(e) => {
          e.stopPropagation()
          toggle('done')
        }}
      >
        {leaving && <Icon name="check" size={12} strokeWidth={3.2} round />}
      </button>
      <span className="n">{t.title}</span>
      <span className="e">{t.energy}</span>
      <span className={cn('w', t.time === null && 'hot')}>{t.time ?? 'Find a time'}</span>
    </div>
  )
}

const groupTitle: Record<TaskGroup['id'], string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  'next-week': 'Next week',
  'no-time': 'No time yet'
}

function ProjectView({
  slug,
  name,
  color,
  projectKey
}: {
  slug: string
  name: string
  color: string
  /** The key tasks use for this project (a built-in one, or the slug of a created one) */
  projectKey?: ProjectKey
}): React.JSX.Element {
  const navigate = useNavigate()
  const allGroups = useTasks((s) => s.groups)
  const doneCount = useTasks((s) => (projectKey ? (s.doneTotals[projectKey] ?? 0) : 0))
  const remove = useTasks((s) => s.remove)
  const doneToday = useTasks((s) => s.doneToday)
  // Finished tasks stay visible, ticked, under "Done"
  const [olderDone, setOlderDone] = useState<DoneTask[]>([])
  useEffect(() => {
    if (!projectKey) return
    let alive = true
    void loadDoneTasks(projectKey).then((rows) => alive && setOlderDone(rows))
    return () => {
      alive = false
    }
  }, [projectKey, doneCount])
  const doneList = projectKey
    ? [
        ...doneToday.filter((d) => d.project === projectKey),
        ...olderDone.filter((d) => !doneToday.some((x) => x.id === d.id) && !allGroups.some((g) => g.tasks.some((x) => x.id === d.id)))
      ].sort((a, b) => b.at.localeCompare(a.at))
    : []

  const groups = projectKey
    ? allGroups
        .map((g) => ({ g, tasks: g.tasks.filter((t) => t.project === projectKey) }))
        .filter((x) => x.tasks.length > 0)
    : []
  const open = groups.reduce((n, x) => n + x.tasks.length, 0)
  const plannedMin = groups
    .filter((x) => x.g.id === 'today' || x.g.id === 'tomorrow')
    .flatMap((x) => x.tasks)
    .reduce((n, t) => n + (parseTime(t.time)?.len ?? 0), 0)
  const withTime = groups.filter((x) => x.g.id !== 'no-time').reduce((n, x) => n + x.tasks.length, 0)
  const total = open + doneCount
  const pct = total ? Math.round((doneCount / total) * 100) : 0
  const p = {
    kicker: 'Project',
    summary: total
      ? `${open} open ${open === 1 ? 'task' : 'tasks'}, ${doneCount} done.`
      : 'No tasks yet. Add the first one below.',
    stats: [
      ['Open', String(open)],
      ['Done', String(doneCount)],
      ['Planned', plannedMin ? fmtMin(plannedMin) : '—']
    ] as Array<[string, string]>,
    card: {
      label: total ? 'Progress' : 'Just started',
      headline: `${doneCount} of ${total} tasks done`,
      text: !total
        ? 'Add your first task and Nexday finds a slot for it.'
        : open === 0
          ? 'Everything here is done.'
          : `${withTime} of ${open} open tasks have a time.`
    },
    capture: {
      placeholder: `Add to ${name}… "kick-off call Monday 10:00"`,
      hint: `New items here are filed under ${name} automatically.`
    }
  }

  const customMeta = useProjects((s) => s.custom.find((c) => c.slug === slug))
  const pref = useUI((s) => s.projectPrefs[projectKey ?? slug])
  const about = customMeta?.description || pref?.description || ''
  const dueText = customMeta?.due
    ? new Date(`${customMeta.due}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : ''

  return (
    <main className="panel pj">
      <div className="pj-top">
        <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
        <span style={{ fontSize: 13, color: 'var(--ink3)' }}>Projects</span>
        <span style={{ color: '#BDBDBA' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
        <span style={{ flex: 1 }} />
        <Button variant="dark" onClick={() => useUI.getState().openNew('task')}>
          + New
        </Button>
      </div>

      <div className="panel-scroll">
        <div className="pj-head">
          <div className="col" style={{ gap: 6, flex: 1 }}>
            <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{p.kicker}</span>
            <span className="pj-title">{name}</span>
            <span style={{ fontSize: 13.5, color: 'var(--ink2)', marginTop: 4 }}>{p.summary}</span>
            {about && <span style={{ fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>{about}</span>}
            {dueText && <span style={{ fontSize: 13, color: 'var(--ink3)' }}>Due {dueText}</span>}
          </div>
          <div className="pj-stats">
            {p.stats.map(([label, value], i) => (
              <div className="row" key={label} style={{ height: '100%' }}>
                {i > 0 && <div className="pj-vr" />}
                <div className="pj-stat">
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="pj-rule" />

        <div className="pj-body">
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            {groups.map(({ g, tasks }) => (
              <div className="col" key={g.id}>
                <div className="pj-gh">
                  {groupTitle[g.id]}
                  <i>{tasks.length}</i>
                </div>
                {tasks.map((t) => (
                  <OpenRow key={t.id} task={t} onOpen={() => navigate(`/tasks/${t.id}`)} onDone={() => remove(t.id)} />
                ))}
              </div>
            ))}
            {doneList.length > 0 && (
              <div className="col">
                <GroupHeader title="Done" meta={String(doneCount || doneList.length)} />
                {doneList.map((t, i) => (
                  <TaskRow
                    key={t.id}
                    id={t.id}
                    done
                    title={t.title}
                    project={t.project}
                    energy={t.energy}
                    time={t.time ?? '—'}
                    onToggle={() => useTasks.getState().reopen(t.id, t)}
                    last={i === doneList.length - 1}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="pj-side">
            <div className="pj-card">
              <div className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                {p.card.label}
              </div>
              <span style={{ fontSize: 22, fontWeight: 500, marginTop: 6 }}>{p.card.headline}</span>
              <div className="pj-bar">
                <i style={{ width: `${pct}%`, background: color }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>{p.card.text}</span>
              <div className="row" style={{ marginTop: 12 }}>
                <span
                  style={{ fontSize: 13.5, color: 'var(--ink2)', cursor: 'pointer' }}
                  onClick={() => useUI.getState().openDialog('projectSettings', slug)}
                >
                  Edit project
                </span>
                <span style={{ flex: 1 }} />
                <Button variant="dark" onClick={() => navigate('/tasks')}>
                  Plan this week
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <QuickCapture
        placeholder={p.capture.placeholder}
        button="Add"
        hint={p.capture.hint}
        onSubmit={
          projectKey
            ? (text) => {
                const { task, group } = toTask(parseCapture(text), projectKey)
                useTasks.getState().add({ ...task, project: projectKey }, group)
              }
            : undefined
        }
      />
    </main>
  )
}
