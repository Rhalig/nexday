import { create } from 'zustand'
import { taskGroups, type Project, type Subtask, type Task, type TaskGroup } from '../data/tasks'
import { supabase } from '../lib/supabase'
import { fmtMin, parseTime } from '../lib/today'

/** Group header text: the task count, plus the total length when the tasks have one. */
const metaOf = (tasks: Task[]): string => {
  const min = tasks.reduce((n, t) => n + (parseTime(t.time)?.len ?? 0), 0)
  return min ? `${tasks.length} · ${fmtMin(min)}` : String(tasks.length)
}
const withMeta = (groups: TaskGroup[]): TaskGroup[] =>
  groups.map((g) => ({ ...g, meta: metaOf(g.tasks) }))

/** Why a task left the open list: finished, or thrown away. The cloud layer reads this to save the right thing. */
export const removalMode = new Map<string, 'done' | 'deleted'>()

const groupTitles: Record<TaskGroup['id'], string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  'next-week': 'Next week',
  'no-time': 'No time yet'
}
const order: TaskGroup['id'][] = ['today', 'tomorrow', 'next-week', 'no-time']

/** A task finished today: kept so Today can show what is already done. */
export type DoneTask = Pick<Task, 'id' | 'title' | 'project' | 'energy' | 'time'> & {
  /** ISO time it was completed */
  at: string
}

/** Puts tasks into their day groups, creating groups that do not exist yet. */
function insertTasks(
  current: TaskGroup[],
  items: Array<{ task: Task; group: TaskGroup['id'] }>
): TaskGroup[] {
  let groups = current.map((g) => ({ ...g }))
  for (const { task, group } of items) {
    let target = groups.find((g) => g.id === group)
    if (!target) {
      target = { id: group, title: groupTitles[group], meta: '0', tasks: [] }
      groups.push(target)
      groups.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    }
    target.tasks = [...target.tasks, task]
  }
  groups = withMeta(groups)
  return groups
}

type TasksState = {
  groups: TaskGroup[]
  /** Tasks completed today (this session, plus whatever the account saved today). */
  doneToday: DoneTask[]
  /** Completed tasks per project, all time (loaded at sign-in, then counted up in the session). */
  doneTotals: Record<Project, number>
  /** Completing and deleting both take a task off the open list. */
  remove: (id: string, mode?: 'done' | 'deleted') => void
  /** Adds a task to a day group, creating the group when it is empty. */
  add: (task: Task, group: TaskGroup['id']) => void
  /** Adds many tasks at once (import). */
  addMany: (items: Array<{ task: Task; group: TaskGroup['id'] }>) => void
  /** Ids unticked a moment ago: their new rows slide in from above */
  reopened: string[]
  /** Brings a finished task back to the open list (unticking it). A task finished on an earlier day is passed in `from` and returns without a time. */
  reopen: (id: string, from?: DoneTask) => void
  /** Changes a few fields of an open task (the AI refining a quick capture). */
  patch: (id: string, fields: Partial<Pick<Task, 'title' | 'project' | 'energy' | 'estimate' | 'notes'>>) => void
  /** Replaces a task's checklist. */
  setSubtasks: (id: string, subtasks: Subtask[]) => void
  /** Moves one task to another day group with a new time (null = no time). */
  move: (id: string, group: TaskGroup['id'], time: string | null) => void
  /** Give no-time tasks a slot: they move into the given day group. */
  schedule: (
    placements: Array<{ id: string; group: 'today' | 'tomorrow' | 'next-week'; time: string }>
  ) => void
}

export const useTasks = create<TasksState>((set) => ({
  groups: supabase ? [] : taskGroups,
  doneToday: [],
  reopened: [],
  doneTotals: { planner: 0, moving: 0, reading: 0, personal: 0 },
  add: (task, group) => set((s) => ({ groups: insertTasks(s.groups, [{ task, group }]) })),
  addMany: (items) => set((s) => ({ groups: insertTasks(s.groups, items) })),
  remove: (id, mode = 'done') => {
    removalMode.set(id, mode)
    set((s) => {
      const hit = s.groups.flatMap((g) => g.tasks).find((t) => t.id === id)
      const doneToday =
        mode === 'done' && hit
          ? [
              ...s.doneToday.filter((d) => d.id !== id),
              {
                id,
                title: hit.title,
                project: hit.project,
                energy: hit.energy,
                time: hit.time,
                at: new Date().toISOString()
              }
            ]
          : s.doneToday
      return {
        doneToday,
        doneTotals:
          mode === 'done' && hit
            ? { ...s.doneTotals, [hit.project]: (s.doneTotals[hit.project] ?? 0) + 1 }
            : s.doneTotals,
        groups: s.groups
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) }))
        .filter((g) => g.tasks.length > 0)
      }
    })
  },
  reopen: (id, from) =>
    set((s) => {
      const today = s.doneToday.find((x) => x.id === id)
      const d = today ?? from
      if (!d) return s
      // Finished earlier than today: its old time is in the past, so it comes back with no time yet.
      const time = today ? d.time : null
      const group: TaskGroup['id'] = time === null ? 'no-time' : /^\d/.test(time) ? 'today' : 'next-week'
      const task: Task = { id: d.id, title: d.title, project: d.project, energy: d.energy, time }
      setTimeout(() => set((x) => ({ reopened: x.reopened.filter((r) => r !== id) })), 700)
      return {
        reopened: [...s.reopened, id],
        doneToday: s.doneToday.filter((x) => x.id !== id),
        doneTotals: { ...s.doneTotals, [d.project]: Math.max(0, (s.doneTotals[d.project] ?? 0) - 1) },
        groups: insertTasks(s.groups, [{ task, group }])
      }
    }),
  patch: (id, fields) =>
    set((s) => ({
      groups: s.groups.map((g) => ({
        ...g,
        tasks: g.tasks.map((t) => (t.id === id ? { ...t, ...fields } : t))
      }))
    })),
  setSubtasks: (id, subtasks) =>
    set((s) => ({
      groups: s.groups.map((g) => ({
        ...g,
        tasks: g.tasks.map((t) => (t.id === id ? { ...t, subtasks } : t))
      }))
    })),
  move: (id, group, time) =>
    set((s) => {
      const hit = s.groups.flatMap((g) => g.tasks).find((t) => t.id === id)
      if (!hit) return s
      const rest = s.groups
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) }))
        .filter((g) => g.tasks.length > 0)
      return { groups: insertTasks(rest, [{ task: { ...hit, time }, group }]) }
    }),
  schedule: (placements) =>
    set((s) => {
      const moved: Array<{ task: Task; group: 'today' | 'tomorrow' | 'next-week' }> = []
      let groups = s.groups.map((g) => ({
        ...g,
        tasks: g.tasks.filter((t) => {
          const p = placements.find((x) => x.id === t.id)
          if (!p) return true
          moved.push({ task: { ...t, time: p.time }, group: p.group })
          return false
        })
      }))
      for (const m of moved) {
        if (!groups.some((g) => g.id === m.group)) {
          groups.push({ id: m.group, title: groupTitles[m.group], meta: '0', tasks: [] })
          groups.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        }
        groups = groups.map((g) => (g.id === m.group ? { ...g, tasks: [...g.tasks, m.task] } : g))
      }
      // keep the leading count in "3 · 1h 20m" in step with the group
      return { groups: withMeta(groups.filter((g) => g.tasks.length > 0)) }
    })
}))

export const countOpen = (groups: TaskGroup[]): number =>
  groups.reduce((n, g) => n + g.tasks.length, 0)
