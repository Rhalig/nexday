import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import TaskDrawer from '../pages/tasks/TaskDrawer'
import { useTasks } from '../store/tasks'
import { useUI } from '../store/ui'

/**
 * The task detail drawer, shared by every page: clicking a task anywhere opens it right there,
 * over the page the person is on. It closes when they go to another page.
 */
export function TaskDrawerHost(): React.JSX.Element | null {
  const id = useUI((s) => s.taskId)
  const closeTask = useUI((s) => s.closeTask)
  const groups = useTasks((s) => s.groups)
  const doneToday = useTasks((s) => s.doneToday)
  const { pathname } = useLocation()

  useEffect(() => {
    closeTask()
  }, [pathname, closeTask])

  const open = id ? groups.flatMap((g) => g.tasks.map((t) => ({ task: t, groupId: g.id }))).find((x) => x.task.id === id) : undefined
  // A task finished from its own drawer stays open there, ticked, until the drawer is closed.
  const finished = id && !open ? doneToday.find((d) => d.id === id) : undefined

  useEffect(() => {
    if (id && !open && !finished) closeTask()
  }, [id, open, finished, closeTask])

  if (!open && !finished) return null
  return (
    // One drawer for both states, so ticking only flips the checkbox (no remount, no slide-in again).
    <TaskDrawer
      key="task-drawer"
      done={!open}
      task={
        open
          ? open.task
          : { id: finished!.id, title: finished!.title, project: finished!.project, energy: finished!.energy, time: finished!.time }
      }
      groupId={open ? open.groupId : 'today'}
      onClose={closeTask}
    />
  )
}
