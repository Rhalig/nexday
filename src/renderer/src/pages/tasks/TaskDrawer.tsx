import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import type { Subtask } from '../../data/tasks'
import { ConfirmDialog, DrawerHeader, PopMenu, type MenuItem } from '../../components/DrawerParts'
import { Drawer } from '../../components/Drawer'
import { Icon } from '../../components/Icon'
import { Button, cn, projectColor } from '../../components/ui'
import { projects, taskDetails, type Energy, type Project, type Task, type TaskGroup } from '../../data/tasks'
import { useTasks } from '../../store/tasks'
import { clockOf, lengthOf, moveToGroup, placeTask } from '../../lib/taskMove'


type Props = { task: Task; groupId: TaskGroup['id']; onClose: () => void; done?: boolean }

export default function TaskDrawer({ task: taskProp, groupId, onClose, done = false }: Props): React.JSX.Element {
  const remove = useTasks((s) => s.remove)
  const setSubtasks = useTasks((s) => s.setSubtasks)
  // read the live task so checklist edits show at once
  const task = useTasks((s) => s.groups.flatMap((g) => g.tasks).find((t) => t.id === taskProp.id)) ?? taskProp
  const subs: Subtask[] = task.subtasks ?? []
  const patch = useTasks((s) => s.patch)
  // The task can move between day groups while the drawer is open, so read its group live.
  const liveGroup = useTasks((s) => s.groups.find((g) => g.tasks.some((t) => t.id === taskProp.id))?.id) ?? groupId
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [notesDraft, setNotesDraft] = useState(task.notes ?? taskDetails[task.title]?.notes ?? '')
  const commitTitle = (): void => {
    const t = titleDraft.trim().slice(0, 200)
    if (!t) setTitleDraft(task.title)
    else if (t !== task.title) patch(task.id, { title: t })
  }
  const clock = clockOf(task.time)
  const len = lengthOf(task.time, task.estimate)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const save = (next: Subtask[]): void => setSubtasks(task.id, next)
  const addSub = (): void => {
    const title = draft.trim().slice(0, 200)
    if (title) save([...subs, { id: crypto.randomUUID(), title, done: false }])
    setDraft('')
  }
  const commitEdit = (): void => {
    const title = editText.trim().slice(0, 200)
    if (editing) save(title ? subs.map((x) => (x.id === editing ? { ...x, title } : x)) : subs.filter((x) => x.id !== editing))
    setEditing(null)
  }
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const navigate = useNavigate()
  const detail = taskDetails[task.title]
  const subDone = subs.filter((x) => x.done).length

  const tomorrow = (): void => {
    moveToGroup(task.id, 'tomorrow')
    onClose()
  }

  // Ticking keeps the drawer open: the box turns ticked, and ticking it again reopens the task.
  const finish = (): void => {
    if (done) useTasks.getState().reopen(task.id)
    else remove(task.id)
  }

  const items: MenuItem[] = [
    { icon: <Icon name="clock" />, label: 'Start focus', hint: 'F', onSelect: () => navigate(`/focus/${task.id}`) },
    {
      icon: <Icon name="copy" />,
      label: 'Duplicate',
      onSelect: () => {
        const group = useTasks.getState().groups.find((g) => g.tasks.some((t) => t.id === task.id))?.id ?? 'no-time'
        useTasks.getState().add({ ...task, id: crypto.randomUUID(), subtasks: undefined }, group)
        onClose()
      }
    },
    { icon: <Icon name="arrowRight" />, label: 'Move to tomorrow', onSelect: tomorrow },
    'sep',
    { icon: <Icon name="trash" />, label: 'Delete task', hint: '⌫', danger: true, onSelect: () => setConfirm(true) }
  ]

  return (
    <>
      <Drawer onClose={onClose}>
        <DrawerHeader
          color={projectColor[task.project]}
          section="Tasks"
          name={projects[task.project].name}
          onMore={() => setMenu(true)}
          onClose={onClose}
        />

        <div className="dw-scroll">
          <div className="row" style={{ gap: 14, marginTop: 22, alignItems: 'flex-start' }}>
            <button
              className={cn('dw-cb', done && 'on')}
              aria-label={done ? 'Mark not done' : 'Complete'}
              onClick={finish}
              style={{ width: 22, height: 22, borderRadius: 7, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {done && <Icon name="check" size={13} strokeWidth={3.2} round />}
            </button>
            <input
              className="dw-title-in"
              value={titleDraft}
              maxLength={200}
              disabled={done}
              aria-label="Task title"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
          </div>

          {detail?.hint && (
            <div className="row" style={{ gap: 6, marginTop: 14, paddingLeft: 36 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#F38020">
                <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
              </svg>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{detail.hint}</span>
            </div>
          )}

          <div className="col" style={{ marginTop: 26, ...(done ? { opacity: 0.55, pointerEvents: 'none' as const } : null) }}>
            <div className="dw-p">
              <span className="k">When</span>
              <span className="v">
                <select
                  className="dw-sel"
                  value={liveGroup}
                  aria-label="Day"
                  onChange={(e) => placeTask(task.id, e.target.value as TaskGroup['id'])}
                >
                  <option value="today">Today</option>
                  <option value="tomorrow">Tomorrow</option>
                  <option value="next-week">Next week</option>
                  <option value="no-time">No time yet</option>
                </select>
                {liveGroup !== 'no-time' && (
                  <input
                    className="dw-sel dw-mono"
                    type="time"
                    step={300}
                    value={clock ?? '09:00'}
                    aria-label="Start time"
                    onChange={(e) => e.target.value && placeTask(task.id, liveGroup, { clock: e.target.value })}
                  />
                )}
              </span>
            </div>
            <div className="dw-p">
              <span className="k">Project</span>
              <span className="v">
                <span style={{ width: 9, height: 9, borderRadius: 3, background: projectColor[task.project] }} />
                <select
                  className="dw-sel"
                  value={task.project}
                  aria-label="Project"
                  onChange={(e) => patch(task.id, { project: e.target.value as Project })}
                >
                  {(Object.keys(projects) as Project[]).map((p) => (
                    <option key={p} value={p}>
                      {projects[p].name}
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <div className="dw-p">
              <span className="k">Length</span>
              <span className="v">
                <select
                  className="dw-sel"
                  value={len}
                  aria-label="Length"
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (liveGroup === 'no-time') patch(task.id, { estimate: n })
                    else placeTask(task.id, liveGroup, { len: n })
                  }}
                >
                  {[...new Set([5, 10, 15, 20, 30, 45, 60, 90, 120, 180, len])]
                    .sort((x, y) => x - y)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}` : `${n} min`}
                      </option>
                    ))}
                </select>
              </span>
            </div>
            <div className="dw-p">
              <span className="k">Energy</span>
              <span className="v">
                <select
                  className="dw-sel"
                  value={task.energy}
                  aria-label="Energy"
                  onChange={(e) => patch(task.id, { energy: e.target.value as Energy })}
                >
                  <option value="Light">Light</option>
                  <option value="Deep focus">Deep focus</option>
                </select>
              </span>
            </div>
            <div className={cn('dw-p', !detail?.linkedEvent && 'last')}>
              <span className="k">Repeat</span>
              <span className="v" style={{ color: 'var(--ink3)' }}>
                Does not repeat
              </span>
            </div>
            {detail?.linkedEvent && (
              <div className="dw-p last">
                <span className="k">Linked to</span>
                <span className="v">
                  <Icon name="calendarLg" size={14} strokeWidth={1.7} round />
                  {detail.linkedEvent.title} · <span className="dw-mono">{detail.linkedEvent.time}</span>
                </span>
              </div>
            )}
          </div>

          <div className="dw-h">Notes</div>
          <textarea
            className="dw-notes"
            placeholder="Add notes"
            value={notesDraft}
            maxLength={4000}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => notesDraft !== (task.notes ?? '') && patch(task.id, { notes: notesDraft })}
          />

          <div className="dw-h" style={{ paddingTop: 28 }}>
            Subtasks
            <span style={{ flex: 1 }} />
            {subs.length > 0 && (
              <span style={{ fontSize: 12.5 }}>
                {subDone} of {subs.length}
              </span>
            )}
          </div>
          {subs.map((x) => (
            <div className="dw-row" key={x.id}>
              <button
                className={cn('dw-cb', x.done && 'on')}
                aria-label={x.done ? 'Mark not done' : 'Mark done'}
                onClick={() => save(subs.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)))}
              >
                {x.done && <Icon name="check" size={11} strokeWidth={3.5} round />}
              </button>
              {editing === x.id ? (
                <input
                  autoFocus
                  className="dw-sub-in"
                  value={editText}
                  maxLength={200}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <span
                  style={{ flex: 1, cursor: 'text', ...(x.done ? { color: 'var(--ink3)', textDecoration: 'line-through' } : {}) }}
                  onClick={() => {
                    setEditing(x.id)
                    setEditText(x.title)
                  }}
                >
                  {x.title}
                </span>
              )}
              <button
                className="dw-sub-x"
                aria-label="Delete subtask"
                onClick={() => save(subs.filter((y) => y.id !== x.id))}
              >
                <Icon name="x" size={12} strokeWidth={2} round />
              </button>
            </div>
          ))}
          {adding ? (
            <div className="dw-row last">
              <Icon name="plus" size={14} strokeWidth={2} round />
              <input
                autoFocus
                className="dw-sub-in"
                placeholder="Subtask, then Enter"
                value={draft}
                maxLength={200}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  addSub()
                  setAdding(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSub()
                  if (e.key === 'Escape') {
                    setDraft('')
                    setAdding(false)
                  }
                }}
              />
            </div>
          ) : (
            <button className="dw-row last" style={{ color: 'var(--ink3)', width: '100%' }} onClick={() => setAdding(true)}>
              <Icon name="plus" size={14} strokeWidth={2} round />
              Add subtask
            </button>
          )}

          {detail?.linkedNote && (
            <>
              <div className="dw-h" style={{ paddingTop: 28 }}>
                Linked note
              </div>
              <div className="dw-row last" style={{ height: 46 }}>
                <Icon name="docPlain" size={16} strokeWidth={1.7} round />
                <span>{detail.linkedNote.title}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{detail.linkedNote.edited}</span>
              </div>
            </>
          )}

          {detail?.activity && (
            <>
              <div className="dw-h" style={{ paddingTop: 28 }}>
                Activity
              </div>
              {detail.activity.map((a) => (
                <div className="dw-ac" key={a}>
                  <i />
                  <span>{a}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="dw-foot">
          <button style={{ fontSize: 13.5, color: 'var(--ink2)' }} onClick={() => setConfirm(true)}>
            Delete
          </button>
          <span style={{ flex: 1 }} />
          <Button onClick={() => navigate(`/focus/${task.id}`)}>Start focus</Button>
          <Button onClick={tomorrow}>Move to tomorrow</Button>
          <Button variant="dark" onClick={finish}>
            {done ? 'Mark not done' : 'Mark done'}
            <span className="dw-kbd">⌘ D</span>
          </Button>
        </div>
      </Drawer>

      {menu && <PopMenu items={items} onClose={() => setMenu(false)} />}
      {confirm && (
        <ConfirmDialog
          title="Delete this task?"
          body={
            <>
              “{task.title}” will be removed from Tasks
              {task.time ? ` and from your calendar at ${task.time.slice(0, 5)}` : ''}.
              {subs.length ? ` Its ${subs.length} subtasks go with it.` : ''} You can undo for 10 seconds.
            </>
          }
          confirmLabel="Delete task"
          onConfirm={() => {
            remove(task.id, 'deleted')
            onClose()
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  )
}
