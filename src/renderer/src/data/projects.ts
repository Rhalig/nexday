export type ProjectTask = {
  title: string
  energy: 'Deep focus' | 'Light'
  /** "09:30 · 30m", "Mon 09:30" or null for "Find a time" */
  when: string | null
}

export type ProjectTaskGroup = { title: string; meta: string; tasks: ProjectTask[] }

export type SideRow = { title: string; meta: string; bar?: string; milestone?: 'done' | 'todo' }

export type SideSection = {
  title: string
  link?: string
  rows: SideRow[]
}

export type ProjectData = {
  slug: string
  name: string
  color: string
  kicker: string
  summary: string
  stats: Array<[string, string]>
  /** Content tabs, only on the larger project */
  tabs?: Array<{ label: string; count: number }>
  shareable?: boolean
  groups: ProjectTaskGroup[]
  doneCount: number
  card: { label: string; headline: string; pct: number; text: string }
  sections: SideSection[]
  capture: { placeholder: string; hint: string }
}

const BLUE = '#4A78D4'

export const projectList: ProjectData[] = [
  {
    slug: 'planner-mvp',
    name: 'Planner MVP',
    color: 'var(--acc)',
    kicker: 'Project · Due Dec 18',
    summary: '7 open tasks, 3 done. On track to finish a few days early.',
    stats: [
      ['Open', '7'],
      ['Done', '3'],
      ['This week', '6h 40m']
    ],
    tabs: [
      { label: 'All', count: 14 },
      { label: 'Tasks', count: 7 },
      { label: 'Notes', count: 4 },
      { label: 'Events', count: 3 }
    ],
    shareable: true,
    groups: [
      {
        title: 'Today',
        meta: '2 · 1h',
        tasks: [
          { title: 'Sketch empty state screens', energy: 'Deep focus', when: '09:30 · 30m' },
          { title: 'Prepare 3 home screen variations for critique', energy: 'Deep focus', when: '14:30 · 30m' }
        ]
      },
      {
        title: 'Tomorrow',
        meta: '2 · 1h 5m',
        tasks: [
          { title: "Reply to Mert's Slack message", energy: 'Light', when: '10:30 · 5m' },
          { title: 'Write onboarding copy', energy: 'Light', when: '11:00 · 1h' }
        ]
      },
      {
        title: 'Next week',
        meta: '2 · 1h 30m',
        tasks: [
          { title: 'Review PR #48 for the day view', energy: 'Deep focus', when: 'Mon 09:30' },
          { title: 'Review the component spec for Mert', energy: 'Deep focus', when: 'Mon 10:00' }
        ]
      },
      {
        title: 'No time yet',
        meta: '1',
        tasks: [{ title: 'Schedule 1:1 with Ece for next week', energy: 'Light', when: null }]
      }
    ],
    doneCount: 3,
    card: {
      label: 'Due in 31 days',
      headline: '3 of 10 tasks done',
      pct: 30,
      text: 'At this pace you finish on Dec 12, six days early.'
    },
    sections: [
      {
        title: 'Upcoming',
        link: 'Open calendar',
        rows: [
          { title: 'Design critique', meta: 'Today 15:00', bar: BLUE },
          { title: 'User interviews', meta: 'Thu 11:00', bar: BLUE },
          { title: 'Product demo', meta: 'Fri 15:00', bar: BLUE }
        ]
      },
      {
        title: 'Milestones',
        rows: [
          { title: 'Prototype v1', meta: 'Done', milestone: 'done' },
          { title: 'User testing', meta: 'Nov 25', milestone: 'todo' },
          { title: 'Launch', meta: 'Dec 18', milestone: 'todo' }
        ]
      },
      {
        title: 'Notes',
        link: 'View all 4',
        rows: [
          { title: 'Design critique prep', meta: 'Today' },
          { title: 'User interview synthesis', meta: 'Wed' }
        ]
      }
    ],
    capture: {
      placeholder: 'Add to Planner MVP… "review PR #52 Monday 09:30"',
      hint: 'New items here are filed under Planner MVP automatically.'
    }
  },
  {
    slug: 'moving-house',
    name: 'Moving house',
    color: 'var(--work)',
    kicker: 'Project · Move on Dec 1',
    summary: '2 open tasks, 2 done. Nothing is blocking the move.',
    stats: [
      ['Open', '2'],
      ['Done', '2'],
      ['This week', '15m']
    ],
    groups: [
      {
        title: 'Tomorrow',
        meta: '1 · 15m',
        tasks: [{ title: 'Pay rent', energy: 'Light', when: '09:00 · 15m' }]
      },
      {
        title: 'Next week',
        meta: '1 · 1h',
        tasks: [{ title: 'Order new desk lamp', energy: 'Light', when: 'Tue 12:00' }]
      }
    ],
    doneCount: 2,
    card: {
      label: 'Due in 14 days',
      headline: '2 of 4 tasks done',
      pct: 50,
      text: 'Half way there, with two weeks to go.'
    },
    sections: [
      {
        title: 'Milestones',
        rows: [
          { title: 'Sign the lease', meta: 'Done', milestone: 'done' },
          { title: 'Book the moving van', meta: 'Nov 24', milestone: 'todo' },
          { title: 'Move day', meta: 'Dec 1', milestone: 'todo' }
        ]
      }
    ],
    capture: {
      placeholder: 'Add to Moving house… "pay electricity bill Friday 12:00"',
      hint: 'New items here are filed under Moving house automatically.'
    }
  },
  {
    slug: 'reading-list',
    name: 'Reading list',
    color: 'var(--personal)',
    kicker: 'Project · Ongoing',
    summary: '2 open tasks, 1 done. Book club meets tonight at 19:30.',
    stats: [
      ['Open', '2'],
      ['Done', '1'],
      ['This week', '30m']
    ],
    groups: [
      {
        title: 'Today',
        meta: '1 · 30m',
        tasks: [{ title: 'Finish chapter 4 for book club', energy: 'Light', when: '18:00 · 30m' }]
      },
      {
        title: 'Next week',
        meta: '1',
        tasks: [{ title: 'Update portfolio with Planner case study', energy: 'Deep focus', when: 'Wed 11:00' }]
      }
    ],
    doneCount: 1,
    card: {
      label: 'Next up tonight',
      headline: '1 of 3 tasks done',
      pct: 33,
      text: 'Chapter 4 is your last read before book club.'
    },
    sections: [
      {
        title: 'Upcoming',
        link: 'Open calendar',
        rows: [{ title: 'Book club', meta: 'Today 19:30', bar: 'var(--personal)' }]
      },
      {
        title: 'Notes',
        link: 'View all',
        rows: [{ title: 'Book club questions', meta: 'Today' }]
      }
    ],
    capture: {
      placeholder: 'Add to Reading list… "read chapter 5 Friday 20:30"',
      hint: 'New items here are filed under Reading list automatically.'
    }
  }
]
