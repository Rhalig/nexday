import { create } from 'zustand'
import { taskGroups, type Task, type TaskGroup } from '../data/tasks'
import { supabase } from '../lib/supabase'

/** Why a task left the open list: finished, or thrown away. The cloud layer reads this to save the right thing. */
export const removalMode = new Map<string, 'done' | 'deleted'>()

const groupTitles: Record<TaskGroup['id'], string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  'next-week': 'Next week',
  'no-time': 'No time yet'
}
const order: TaskGroup['id'][] = ['today', 'tomorrow', 'next-week', 'no-time']

type TasksState = {
  groups: TaskGroup[]
  /** Completing and deleting both take a task off the open list. */
  remove: (id: string, mode?: 'done' | 'deleted') => void
  /** Adds a task to a day group, creating the group when it is empty. */
  add: (task: Task, group: TaskGroup['id']) => void
  /** Give no-time tasks a slot: they move into the given day group. */
  schedule: (
    placements: Array<{ id: string; group: 'today' | 'tomorrow' | 'next-week'; time: string }>
  ) => void
}

export const useTasks = create<TasksState>((set) => ({
  groups: supabase ? [] : taskGroups,
  add: (task, group) =>
    set((s) => {
      let groups = s.groups.map((g) => ({ ...g }))
      let target = groups.find((g) => g.id === group)
      if (!target) {
        target = { id: group, title: groupTitles[group], meta: '0', tasks: [] }
        groups.push(target)
        groups.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      }
      target.tasks = [...target.tasks, task]
      groups = groups.map((g) => ({ ...g, meta: g.meta.replace(/^\d+/, String(g.tasks.length)) }))
      return { groups }
    }),
  remove: (id, mode = 'done') => {
    removalMode.set(id, mode)
    set((s) => ({
      groups: s.groups
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) }))
        .filter((g) => g.tasks.length > 0)
    }))
  },
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
      groups = groups.map((g) => ({ ...g, meta: g.meta.replace(/^\d+/, String(g.tasks.length)) }))
      return { groups: groups.filter((g) => g.tasks.length > 0) }
    })
}))

export const countOpen = (groups: TaskGroup[]): number =>
  groups.reduce((n, g) => n + g.tasks.length, 0)
