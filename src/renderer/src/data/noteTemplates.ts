import type { IconName } from '../components/Icon'

export const noteTemplates: Array<{
  id: string
  label: string
  icon: IconName
  desc: string
  sections: Array<[string, string]>
}> = [
  {
    id: 'blank',
    label: 'Blank note',
    icon: 'file',
    desc: 'Start with an empty page and press / for commands.',
    sections: []
  },
  {
    id: 'meeting',
    label: 'Meeting notes',
    icon: 'calendar',
    desc: 'Linked to the calendar event you pick. Attendees are filled in for you.',
    sections: [
      ['Attendees', 'Names from the event'],
      ['Agenda', 'What this meeting is for'],
      ['Notes', 'Decisions, numbers, open questions'],
      ['Action items', 'Nexday turns these into tasks']
    ]
  },
  {
    id: 'one',
    label: '1:1',
    icon: 'share',
    desc: 'A running page for one person, carried from week to week.',
    sections: [
      ['Check-in', 'How things are going'],
      ['Topics', 'What to cover this time'],
      ['Action items', 'Nexday turns these into tasks']
    ]
  },
  {
    id: 'critique',
    label: 'Design critique',
    icon: 'checkCircle',
    desc: 'Frame the feedback you want before the session starts.',
    sections: [
      ['Goal', 'What you are showing'],
      ['Questions', 'What to ask the room'],
      ['Feedback', 'What people said'],
      ['Next steps', 'Changes to make']
    ]
  },
  {
    id: 'brief',
    label: 'Project brief',
    icon: 'lines',
    desc: 'One page that explains a project to someone new.',
    sections: [
      ['Problem', 'What we are solving'],
      ['Scope', 'What is in and out'],
      ['Milestones', 'Dates that matter']
    ]
  },
  {
    id: 'reading',
    label: 'Reading notes',
    icon: 'book',
    desc: 'Keep what you read and what it made you think.',
    sections: [
      ['Highlights', 'Lines worth keeping'],
      ['Ideas', 'What it made you think of'],
      ['Questions', 'To bring to book club']
    ]
  },
  {
    id: 'journal',
    label: 'Daily journal',
    icon: 'sunSm',
    desc: 'A few minutes at the end of the day.',
    sections: [
      ['Wins', 'What went well'],
      ['Hard parts', 'What got in the way'],
      ['Tomorrow', 'One thing to start with']
    ]
  }
]

/** The note text a template starts with: its sections as headings, action-item sections ready to type into. */
export function templateText(sections: Array<[string, string]>): string {
  return sections.map(([h]) => `# ${h}\n${/action items|next steps/i.test(h) ? '[ ] ' : ''}`).join('\n')
}
