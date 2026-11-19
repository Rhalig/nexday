import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import type { Subtask } from '../../data/tasks'
import { ConfirmDialog, DrawerHeader, PopMenu, type MenuItem } from '../../components/DrawerParts'
import { Drawer } from '../../components/Drawer'
import { Icon } from '../../components/Icon'
import { Button, cn, projectColor } from '../../components/ui'
import { describeTask, projects, taskDetails, type Task, type TaskGroup } from '../../data/tasks'
import { useTasks } from '../../store/tasks'

import { T } from '../../lib/prefs'

type Props = { task: Task; groupId: TaskGroup['id']; onClose: () => void }

export default function TaskDrawer({ task: taskProp, groupId, onClose }: Props): React.JSX.Element {
  const remove = useTasks((s) => s.remove)
  const setSubtasks = useTasks((s) => s.setSubtasks)
  // read the live task so checklist edits show at once
  const task = useTasks((s) => s.groups.flatMap((g) => g.tasks).find((t) => t.id === taskProp.id)) ?? taskProp
  const subs: Subtask[] = task.subtasks ?? []
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
  const { when: whenRaw, length } = describeTask(task, groupId)
  const when = T(whenRaw)
  const subDone = subs.filter((x) => x.done).length

  const finish = (): void => {
    remove(task.id)
    onClose()
  }

  const items: MenuItem[] = [
    { icon: <Icon name="clock" />, label: 'Start focus', hint: 'F', onSelect: () => navigate('/focus') },
    { icon: <Icon name="copy" />, label: 'Duplicate', hint: '⌘ D', onSelect: () => undefined },
    { icon: <Icon name="arrowRight" />, label: 'Move to tomorrow', hint: 'T', onSelect: () => undefined },
    { icon: <Icon name="folder" />, label: 'Move to project', chevron: true, onSelect: () => undefined },
    { icon: <Icon name="link" />, label: 'Copy link', onSelect: () => undefined },
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
            <button className="dw-cb" aria-label="Complete" onClick={finish} style={{ width: 22, height: 22, borderRadius: 7, marginTop: 3 }} />
            <span style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.35, flex: 1 }}>{task.title}</span>
          </div>

          {detail?.hint && (
            <div className="row" style={{ gap: 6, marginTop: 14, paddingLeft: 36 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#F38020">
                <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
              </svg>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{detail.hint}</span>
            </div>
          )}

          <div className="col" style={{ marginTop: 26 }}>
            <div className="dw-p">
              <span className="k">When</span>
              <span className="v">
                {when.includes(', ') ? (
                  <>
                    {when.split(', ')[0]}, <span className="dw-mono">{when.split(', ')[1]}</span>
                  </>
                ) : (
                  when
                )}
              </span>
            </div>
            <div className="dw-p">
              <span className="k">Project</span>
              <span className="v">
                <span style={{ width: 9, height: 9, borderRadius: 3, background: projectColor[task.project] }} />
                {projects[task.project].name}
              </span>
            </div>
            <div className="dw-p">
              <span className="k">Length</span>
              <span className="v">{length}</span>
            </div>
            <div className="dw-p">
              <span className="k">Energy</span>
              <span className="v">{task.energy}</span>
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

          {detail?.notes && (
            <>
              <div className="dw-h">Notes</div>
              <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink2)' }}>{detail.notes}</span>
            </>
          )}

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
          <Button onClick={onClose}>Move to tomorrow</Button>
          <Button variant="dark" onClick={finish}>
            Mark done
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
