export type NoteCategory = 'meetings' | 'ideas' | 'personal'

export type Note = {
  id: string
  title: string
  summary: string
  group: 'today' | 'week'
  category: NoteCategory
  /** Project chip colour + name */
  chip: { color: string; name: string }
  /** Shown after the dot: linked event ("Critique 15:00") or weekday */
  when: { text: string; mono?: boolean }
  /** Title above the preview ("Linked to ...") for notes tied to an event */
  linked?: string
  edited: string
  /** Full body, present on the sample note that has one */
  body?: {
    goals: string[]
    questions: string
    actionItems: Array<{ title: string; time: string; hot?: boolean }>
  }
}

export const notes: Note[] = [
  {
    id: 'n1',
    title: 'Design critique prep',
    summary: 'Show the variations side by side, not one by one',
    group: 'today',
    category: 'meetings',
    chip: { color: 'var(--acc)', name: 'Planner MVP' },
    when: { text: 'Critique 15:00', mono: true },
    linked: 'Linked to Design critique · Today 15:00',
    edited: 'Edited today at 10:12',
    body: {
      goals: [
        'Show the 3 home screen variations side by side, not one by one.',
        "Save 10 minutes at the end for Ece's feedback.",
        'Ask about the empty states and the progress indicator.'
      ],
      questions:
        'Is the Day strip clear enough without the legend? Does the energy curve help or distract? Check with Mert before Monday.',
      actionItems: [
        { title: 'Prepare 3 home screen variations', time: 'Today 14:30', hot: true },
        { title: 'Ask Ece about empty states', time: 'Today 14:45' },
        { title: 'Check Day strip clarity with Mert', time: 'Mon 10:00' }
      ]
    }
  },
  {
    id: 'n2',
    title: 'Product sync notes',
    summary: 'Agenda: onboarding metrics, Q4 scope, hiring',
    group: 'today',
    category: 'meetings',
    chip: { color: 'var(--work)', name: 'Work' },
    when: { text: 'Sync 11:30', mono: true },
    linked: 'Linked to Product sync · Today 11:30',
    edited: 'Edited today at 09:40'
  },
  {
    id: 'n3',
    title: 'Chapter 4 thoughts',
    summary: 'The author argues that routines beat motivation',
    group: 'today',
    category: 'personal',
    chip: { color: 'var(--personal)', name: 'Reading list' },
    when: { text: 'Book club 19:30', mono: true },
    linked: 'Linked to Book club · Today 19:30',
    edited: 'Edited today at 08:55'
  },
  {
    id: 'n4',
    title: 'User interview synthesis',
    summary: 'Three people skip planning when the list feels long',
    group: 'week',
    category: 'meetings',
    chip: { color: 'var(--acc)', name: 'Planner MVP' },
    when: { text: 'Wed' },
    edited: 'Edited Wednesday'
  },
  {
    id: 'n5',
    title: 'Moving checklist',
    summary: 'Quotes, boxes, utilities, change of address',
    group: 'week',
    category: 'personal',
    chip: { color: 'var(--work)', name: 'Moving house' },
    when: { text: 'Tue' },
    edited: 'Edited Tuesday'
  },
  {
    id: 'n6',
    title: 'Weekly review template',
    summary: 'One score, three wins, one thing to drop',
    group: 'week',
    category: 'ideas',
    chip: { color: 'var(--health)', name: 'Ideas' },
    when: { text: 'Mon' },
    edited: 'Edited Monday'
  }
]

export const noteTabs: Array<{ id: 'all' | NoteCategory; label: string; count: number }> = [
  { id: 'all', label: 'All', count: 14 },
  { id: 'meetings', label: 'Meetings', count: 6 },
  { id: 'ideas', label: 'Ideas', count: 5 },
  { id: 'personal', label: 'Personal', count: 3 }
]
