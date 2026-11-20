import { useLeaving } from '../lib/useLeaving'
import { projects, type Project } from '../data/tasks'
import { Checkbox, cn, projectColor } from './ui'
import { T } from '../lib/prefs'
import { dragProps, type Dragged } from './dnd'

type Props = {
  title: string
  project: Project
  /** Time / duration column text */
  time: string
  energy?: string
  hot?: boolean
  done?: boolean
  /** Narrow time column (Today page) */
  compact?: boolean
  last?: boolean
  enter?: boolean
  onOpen?: () => void
  /** Ticking the box (finishes the task); the click never opens the row */
  onToggle?: () => void
  /** Makes the row draggable (see components/dnd.tsx) */
  drag?: Omit<Dragged, 'offsetY'>
}

export function TaskRow({
  title,
  project,
  time,
  energy,
  hot,
  done,
  compact,
  last,
  enter,
  onOpen,
  onToggle,
  drag
}: Props): React.JSX.Element {
  // Finishing a task: the box ticks, the title strikes through, then the row slides out before it leaves the list.
  const exit = useLeaving(onToggle)
  const leaving = exit.leaving
  const toggle = (): void => (done ? onToggle?.() : exit.toggle())
  return (
    <div
      className={cn('task', done && 'done', leaving && 'leaving', compact && 'compact', last && 'last', enter && 'enter', onOpen && 'clickable')}
      onClick={onOpen}
      {...(drag ? dragProps(drag) : null)}
    >
      <Checkbox
        checked={done || leaving}
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
      />
      <span className="tt">{title}</span>
      <div className="tag">
        <div className="swatch" style={{ background: projectColor[project] }} />
        <span>{projects[project].name}</span>
      </div>
      {energy !== undefined && <span className="en">{energy}</span>}
      <span className={cn('du', hot && 'hot')}>{T(time)}</span>
    </div>
  )
}
