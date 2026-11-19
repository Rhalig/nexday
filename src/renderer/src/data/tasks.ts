export type Project = 'planner' | 'moving' | 'reading' | 'personal'
export type Energy = 'Deep focus' | 'Light'

export type Task = {
  id: string
  title: string
  project: Project
  energy: Energy
  /** Display string; `null` means no time yet */
  time: string | null
  /** Estimated length in minutes, when known */
  estimate?: number
  /** Free-text notes on the task */
  notes?: string
  /** Checklist inside the task */
  subtasks?: Subtask[]
}

export type Subtask = { id: string; title: string; done: boolean }

export type TaskGroup = {
  id: 'today' | 'tomorrow' | 'next-week' | 'no-time'
  title: string
  meta: string
  tasks: Task[]
}

export const projects: Record<Project, { name: string; open: number; done: number }> = {
  planner: { name: 'Planner MVP', open: 7, done: 3 },
  moving: { name: 'Moving house', open: 2, done: 2 },
  reading: { name: 'Reading list', open: 2, done: 1 },
  personal: { name: 'Personal', open: 1, done: 4 }
}

export const taskGroups: TaskGroup[] = [
  {
    id: 'today',
    title: 'Today',
    meta: '3 · 1h 30m',
    tasks: [
      { id: 't1', title: 'Sketch empty state screens', project: 'planner', energy: 'Deep focus', time: '09:30 · 30m' },
      { id: 't2', title: 'Prepare 3 home screen variations for critique', project: 'planner', energy: 'Deep focus', time: '14:30 · 30m', subtasks: [{ id: 's1', title: 'Pick the 3 strongest variations', done: true }, { id: 's2', title: 'Export frames at 2x', done: false }, { id: 's3', title: 'Write a two-line rationale for each', done: false }] },
      { id: 't3', title: 'Finish chapter 4 for book club', project: 'reading', energy: 'Light', time: '18:00 · 30m' }
    ]
  },
  {
    id: 'tomorrow',
    title: 'Tomorrow',
    meta: '3 · 1h 20m',
    tasks: [
      { id: 't4', title: 'Pay rent', project: 'moving', energy: 'Light', time: '09:00 · 15m' },
      { id: 't5', title: "Reply to Mert's Slack message", project: 'planner', energy: 'Light', time: '10:30 · 5m' },
      { id: 't6', title: 'Write onboarding copy', project: 'planner', energy: 'Light', time: '11:00 · 1h' }
    ]
  },
  {
    id: 'next-week',
    title: 'Next week',
    meta: '4 · 2h 55m',
    tasks: [
      { id: 't7', title: 'Review PR #48 for the day view', project: 'planner', energy: 'Deep focus', time: 'Mon 09:30' },
      { id: 't8', title: 'Review the component spec for Mert', project: 'planner', energy: 'Deep focus', time: 'Mon 10:00' },
      { id: 't9', title: 'Order new desk lamp', project: 'moving', energy: 'Light', time: 'Tue 12:00' },
      { id: 't10', title: 'Update portfolio with Planner case study', project: 'reading', energy: 'Deep focus', time: 'Wed 11:00' }
    ]
  },
  {
    id: 'no-time',
    title: 'No time yet',
    meta: '2',
    tasks: [
      { id: 't11', title: 'Schedule 1:1 with Ece for next week', project: 'planner', energy: 'Light', time: null },
      { id: 't12', title: 'Book a dentist appointment', project: 'personal', energy: 'Light', time: null }
    ]
  }
]

export type TaskFilter = 'all' | 'today' | 'upcoming' | 'none'

export const filterGroups: Record<TaskFilter, TaskGroup['id'][]> = {
  all: ['today', 'tomorrow', 'next-week', 'no-time'],
  today: ['today'],
  upcoming: ['tomorrow', 'next-week'],
  none: ['no-time']
}

export const filterTabs: Array<{ id: TaskFilter; label: string; count: number }> = [
  { id: 'all', label: 'All', count: 12 },
  { id: 'today', label: 'Today', count: 3 },
  { id: 'upcoming', label: 'Upcoming', count: 7 },
  { id: 'none', label: 'No time', count: 2 }
]

export type TaskDetail = {
  hint?: string
  linkedEvent?: { title: string; time: string }
  notes?: string
  linkedNote?: { title: string; edited: string }
  activity?: string[]
}

/** Extra detail only exists for the task the design shows in full. */
export const taskDetails: Record<string, TaskDetail> = {
  'Prepare 3 home screen variations for critique': {
    hint: 'Placed in your best focus hours. It ends right before Design critique.',
    linkedEvent: { title: 'Design critique', time: '15:00' },
    notes:
      'Show the variations side by side, not one by one. Include empty states and keep the rationale to two lines each.',
    linkedNote: { title: 'Design critique prep', edited: 'Edited today 10:12' },
    activity: [
      'Added from the note Design critique prep · yesterday 18:12',
      'Nexday moved it from 13:00 to 14:30 to keep a gap before the critique'
    ]
  }
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const fromMinutes = (n: number): string =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

/** "09:30 · 30m" → { when: "Today, 09:30 – 10:00", length: "30 min" } */
export function describeTask(task: Task, groupId: TaskGroup['id']): { when: string; length: string } {
  if (task.time === null) return { when: 'Not scheduled yet', length: '—' }
  const m = task.time.match(/^(\d{2}:\d{2}) · (?:(\d+)h)?\s?(?:(\d+)m)?$/)
  if (m) {
    const len = (m[2] ? Number(m[2]) * 60 : 0) + (m[3] ? Number(m[3]) : 0)
    const start = m[1]
    const day = groupId === 'tomorrow' ? 'Tomorrow' : 'Today'
    const length = len >= 60 ? `${Math.floor(len / 60)} h${len % 60 ? ` ${len % 60} min` : ''}` : `${len} min`
    return { when: `${day}, ${start} – ${fromMinutes(toMinutes(start) + len)}`, length }
  }
  return { when: task.time, length: '—' }
}
