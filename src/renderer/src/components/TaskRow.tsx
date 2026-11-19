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
  drag
}: Props): React.JSX.Element {
  return (
    <div
      className={cn('task', done && 'done', compact && 'compact', last && 'last', enter && 'enter', onOpen && 'clickable')}
      onClick={onOpen}
      {...(drag ? dragProps(drag) : null)}
    >
      <Checkbox checked={done} />
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
