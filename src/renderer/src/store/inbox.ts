import { create } from 'zustand'
import type { IconName } from '../components/Icon'
import { newId, parseCapture, slotFor, toTask } from '../lib/capture'
import { appToday, dayKey } from '../lib/clock'
import type { Project } from '../data/tasks'
import { useCalendar } from './calendar'
import { useNotes } from './notes'
import { supabase } from '../lib/supabase'
import { useTasks } from './tasks'

export type InboxSource = 'capture' | 'email' | 'slack' | 'github'

export type InboxItem = {
  id: string
  source: InboxSource
  group: 'new' | 'yesterday'
  title: string
  meta: string
  /** Compact suggestion chip */
  suggestion: { icon: IconName; label: string; plain?: boolean }
  /** Present on items that can be shown in the expanded triage card */
  focus?: {
    kind: string
    time: string
    project: string
    duration: string
    reason: string
    /** What the AI read from the text: lets accepting create the right thing */
    plan?: { date: string | null; time: string | null; minutes: number | null; project: Project }
  }
}

export const sampleInbox: InboxItem[] = [
  {
    id: 'i1',
    source: 'capture',
    group: 'new',
    title: 'Call the moving company about the Friday slot',
    meta: 'Captured by you · 2 min ago · via quick capture',
    suggestion: { icon: 'tasks', label: 'Task · Today 13:30' },
    focus: {
      kind: 'task',
      time: '13:30',
      project: 'Moving house',
      duration: '15 min',
      reason:
        'It fits your free gap between 13:00 and 15:00. The office closes at 17:00, so this is your last good window today. Tap any underlined word to change it.'
    }
  },
  {
    id: 'i2',
    source: 'email',
    group: 'new',
    title: 'Reply to Ece about onboarding feedback',
    meta: 'Email · Ece Çelik · 10:42',
    suggestion: { icon: 'tasks', label: 'Task · Today 14:00' }
  },
  {
    id: 'i3',
    source: 'slack',
    group: 'new',
    title: 'Review the component spec for Mert',
    meta: 'Slack · Mert Kaya in #planner-mvp · 09:15',
    suggestion: { icon: 'tasks', label: 'Task · Mon 10:00' }
  },
  {
    id: 'i4',
    source: 'email',
    group: 'new',
    title: 'Dinner at Neolokal, confirmed',
    meta: 'Email · Neolokal Dining · 08:00',
    suggestion: { icon: 'calendar', label: 'Event · Fri 19:00' }
  },
  {
    id: 'i5',
    source: 'github',
    group: 'yesterday',
    title: 'Review PR #48 for the day view',
    meta: 'GitHub · Ece requested your review · 14:07',
    suggestion: { icon: 'tasks', label: 'Task · Mon 09:30' }
  },
  {
    id: 'i6',
    source: 'capture',
    group: 'yesterday',
    title: 'Idea: a weekly review template with a score',
    meta: 'Captured by you · 22:40',
    suggestion: { icon: 'file', label: 'Note · Ideas', plain: true }
  }
]

type InboxState = {
  items: InboxItem[]
  /** Accept = turn the suggestion into a task / event / note. Removes it from the inbox. */
  accept: (id: string) => void
  dismiss: (id: string) => void
  reset: () => void
  /** A line from quick capture lands in the inbox first; returns its id. */
  capture: (text: string) => string
  /** The AI suggestion arrives a moment later and replaces the regex one in place. */
  refine: (
    id: string,
    patch: { suggestion?: InboxItem['suggestion']; focus?: InboxItem['focus'] }
  ) => void
}

const addMinutes = (hhmm: string, n: number): string => {
  const t = Math.min(23 * 60 + 59, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + n)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Turns an accepted AI suggestion into an event, a task or a note. */
function applyPlan(title: string, kind: string, plan: NonNullable<NonNullable<InboxItem['focus']>['plan']>): void {
  const today = appToday()
  if (kind === 'event') {
    const start = plan.time ?? '09:00'
    useCalendar.getState().add({
      title,
      date: plan.date ?? dayKey(today),
      start,
      end: addMinutes(start, plan.minutes ?? 60),
      allDay: false
    })
  } else if (kind === 'note') {
    useNotes.getState().add(title)
  } else {
    const { group, time } = slotFor(plan.date, plan.time, plan.minutes)
    useTasks.getState().add(
      {
        id: newId('t'),
        title,
        project: plan.project,
        energy: 'Light',
        time,
        ...(plan.minutes ? { estimate: plan.minutes } : {})
      },
      group
    )
  }
}

export const useInbox = create<InboxState>((set) => ({
  items: supabase ? [] : sampleInbox,
  accept: (id) =>
    set((s) => {
      const item = s.items.find((i) => i.id === id)
      if (item?.focus?.plan) {
        applyPlan(item.title, item.focus.kind, item.focus.plan)
        return { items: s.items.filter((i) => i.id !== id) }
      }
      // A task suggestion becomes a real task; events and notes are only cleared for now.
      if (item && item.suggestion.label.startsWith('Task')) {
        const hint = item.suggestion.label.replace(/^Task · /, '')
        const { task, group } = toTask(parseCapture(`${item.title} ${hint}`))
        useTasks.getState().add({ ...task, title: item.title }, group)
      }
      return { items: s.items.filter((i) => i.id !== id) }
    }),
  capture: (text) => {
    const p = parseCapture(text)
    const when = p.time ? ` · ${p.group === 'tomorrow' ? 'Tomorrow' : 'Today'} ${p.time}` : ''
    const item: InboxItem = {
      id: newId('i'),
      source: 'capture',
      group: 'new',
      title: p.title,
      meta: 'Captured by you · just now · via quick capture',
      suggestion: { icon: 'tasks', label: `Task${when}` }
    }
    set((s) => ({ items: [item, ...s.items] }))
    return item.id
  },
  refine: (id, patch) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i))
    })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  reset: () => set({ items: sampleInbox })
}))

export const sourceIcon: Record<InboxSource, IconName> = {
  capture: 'plus',
  email: 'mail',
  slack: 'hash',
  github: 'git'
}
