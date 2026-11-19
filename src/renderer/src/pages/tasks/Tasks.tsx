import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Topbar, PageHead } from '../../components/page'
import { QuickCapture } from '../../components/QuickCapture'
import { TaskRow } from '../../components/TaskRow'
import { Button, GroupHeader, Segmented, Toggle, projectColor } from '../../components/ui'
import { filterGroups, projects, type Project, type TaskFilter } from '../../data/tasks'
import { countOpen, useTasks } from '../../store/tasks'
import { useUI } from '../../store/ui'
import { parseCapture, toTask } from '../../lib/capture'
import { pageDate } from '../../lib/clock'
import {
  FilterPopover,
  defaultView,
  isDefaultView,
  passesFilter,
  type TaskView
} from '../../components/Pickers'
import type { Task, TaskGroup } from '../../data/tasks'
import TaskDrawer from './TaskDrawer'
import './tasks.css'

const projectOrder: Array<{ id: Project; pct: number }> = [
  { id: 'planner', pct: 30 },
  { id: 'moving', pct: 50 },
  { id: 'reading', pct: 33 },
  { id: 'personal', pct: 80 }
]

const lengthOf = (t: Task): number => {
  const m = t.time?.match(/(\d+)(h|m)\s*$/)
  return m ? Number(m[1]) * (m[2] === 'h' ? 60 : 1) : 0
}

function applyView(groups: TaskGroup[], v: TaskView): TaskGroup[] {
  const sortFn = (a: Task, b: Task): number =>
    v.sort === 'Project'
      ? a.project.localeCompare(b.project)
      : v.sort === 'Energy'
        ? a.energy.localeCompare(b.energy)
        : v.sort === 'Length'
          ? lengthOf(a) - lengthOf(b)
          : 0
  let out = groups
    .map((g) => ({ ...g, tasks: g.tasks.filter((t) => passesFilter(t, v)).sort(sortFn) }))
    .filter((g) => g.tasks.length > 0)
  if (v.group === 'Project') {
    const names = projects
    const all = out.flatMap((g) => g.tasks)
    out = (Object.keys(names) as Project[])
      .map((id) => {
        const ts = all.filter((t) => t.project === id)
        return {
          id: id as unknown as TaskGroup['id'],
          title: names[id].name,
          meta: String(ts.length),
          tasks: ts
        }
      })
      .filter((g) => g.tasks.length > 0)
  } else if (v.group === 'None') {
    const all = out.flatMap((g) => g.tasks)
    out = all.length
      ? [{ id: 'today', title: 'All tasks', meta: String(all.length), tasks: all }]
      : []
  }
  return out
}

export default function Tasks(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const allGroups = useTasks((s) => s.groups)
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [showEnergy, setShowEnergy] = useState(true)
  const [view, setView] = useState<TaskView>(defaultView)
  const [pop, setPop] = useState<{ right: number; top: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const openDialog = useUI((st) => st.openDialog)

  const groups = applyView(
    allGroups.filter((g) => filterGroups[filter].includes(g.id)),
    view
  )
  const total = countOpen(allGroups)
  const openByProject = (p: Project): number =>
    allGroups.reduce((n, g) => n + g.tasks.filter((t) => t.project === p).length, 0)
  const sizeOf = (ids: string[]): number =>
    allGroups.filter((g) => ids.includes(g.id)).reduce((n, g) => n + g.tasks.length, 0)
  const noTime = sizeOf(['no-time'])
  const filterTabs = [
    { id: 'all' as TaskFilter, label: 'All', count: total },
    { id: 'today' as TaskFilter, label: 'Today', count: sizeOf(['today']) },
    { id: 'upcoming' as TaskFilter, label: 'Upcoming', count: sizeOf(['tomorrow', 'next-week']) },
    { id: 'none' as TaskFilter, label: 'No time', count: noTime }
  ]
  const open = id
    ? allGroups
        .flatMap((g) => g.tasks.map((t) => ({ task: t, groupId: g.id })))
        .find((x) => x.task.id === id)
    : undefined

  return (
    <main className="panel">
      <Topbar icon="tasks" section="Tasks" current="All open" />

      <div className="panel-scroll">
        <PageHead
          date={pageDate()}
          title="Tasks"
          sub={`${total} open tasks. ${total - noTime} already have a time on your calendar.`}
          stats={[
            ['Open', String(total)],
            ['Planned', '6h 15m'],
            ['No time yet', String(noTime)]
          ]}
        />

        <div className="tasks-toolbar" ref={toolbarRef}>
          <Segmented items={filterTabs} value={filter} onChange={setFilter} />
          <div className="tasks-opts">
            <span
              style={{ cursor: 'pointer', color: isDefaultView(view) ? undefined : 'var(--ink)' }}
              onClick={() => {
                const r = toolbarRef.current!.getBoundingClientRect()
                setPop({ right: r.right, top: r.bottom + 1 })
              }}
            >
              {view.group === 'None' ? 'Not grouped' : `Grouped by ${view.group.toLowerCase()}`}
            </span>
            <span>·</span>
            <span>Show energy</span>
            <Toggle on={showEnergy} onChange={setShowEnergy} />
          </div>
        </div>

        {pop && (
          <FilterPopover
            anchor={pop}
            view={view}
            setView={setView}
            tasks={allGroups.flatMap((g) => g.tasks)}
            onClose={() => setPop(null)}
          />
        )}

        <div className="tasks-body">
          <section className="tasks-list">
            {groups.map((g, gi) => (
              <div key={g.id} className="col">
                <GroupHeader title={g.title} meta={g.meta} />
                {g.tasks.map((t, ti) => (
                  <TaskRow
                    key={t.id}
                    title={t.title}
                    project={t.project}
                    energy={t.energy}
                    time={t.time ?? 'Find a time'}
                    hot={t.time === null}
                    onOpen={() => navigate(`/tasks/${t.id}`)}
                    last={gi === groups.length - 1 && ti === g.tasks.length - 1}
                  />
                ))}
              </div>
            ))}
          </section>

          <aside className="tasks-side">
            <div className="findtime">
              <div className="row" style={{ gap: 8 }}>
                <div className="findtime-dot" />
                <span className="muted" style={{ fontSize: 12 }}>
                  {noTime} tasks have no time
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 500, marginTop: 10 }}>
                Find time for them
              </span>
              <span className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                Open slots: tomorrow 11:00 and Mon 14:00.
              </span>
              <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
                <button className="row" style={{ height: 36, padding: '0 4px' }}>
                  <span className="muted" style={{ fontSize: 13 }}>
                    Not now
                  </span>
                </button>
                <Button variant="dark" onClick={() => openDialog('autoSchedule')}>
                  <span>Auto-schedule</span>
                </Button>
              </div>
            </div>

            <div className="col">
              <div className="side-head">
                <h2>By project</h2>
                <a href="#/tasks" className="muted" style={{ fontSize: 12.5 }}>
                  View all
                </a>
              </div>
              {projectOrder.map(({ id, pct }, i) => (
                <div key={id} className={i === projectOrder.length - 1 ? 'proj last' : 'proj'}>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="swatch" style={{ background: projectColor[id] }} />
                    <span style={{ flex: 1, fontSize: 13.5 }}>{projects[id].name}</span>
                    <span className="mono muted" style={{ fontSize: 12.5 }}>
                      {openByProject(id)} open · {projects[id].done} done
                    </span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${pct}%`, background: projectColor[id] }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="col">
              <div className="side-head">
                <h2>Deep focus this week</h2>
              </div>
              <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                <span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>
                  6h 30m
                </span>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  of your 10h goal
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', marginTop: 10 }}>
                <div
                  style={{ width: '65%', height: 4, borderRadius: 2, background: 'var(--acc)' }}
                />
              </div>
              <span className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                Deep tasks are placed in your best hours, 09:00 to 11:00.
              </span>
            </div>
          </aside>
        </div>
      </div>

      <QuickCapture
        placeholder={'Add a task… "pay electricity bill Friday 12:00 #moving"'}
        button="Add"
        hint="Nexday reads the day, time and project from plain language."
        onSubmit={(text) => {
          const { task, group } = toTask(parseCapture(text))
          useTasks.getState().add(task, group)
        }}
      />
      {open && (
        <TaskDrawer task={open.task} groupId={open.groupId} onClose={() => navigate('/tasks')} />
      )}
    </main>
  )
}
