import { useEffect, useRef, useState } from 'react'
import { useLeaving } from '../lib/useLeaving'
import { useTasks } from '../store/tasks'
import { projects, type Project } from '../data/tasks'
import { Checkbox, cn, projectColor } from './ui'
import { T } from '../lib/prefs'
import { dragProps, type Dragged } from './dnd'

type Props = {
  /** The task's id: lets the row slide in from above when it has just been unticked */
  id?: string
  /** The row keeps its place when its state flips (Today's list): it settles instead of sliding out */
  stay?: boolean
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
  id,
  stay,
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
  // Ticking slides the row away (to the side); unticking slides it up. A row that stays put only settles.
  const exit = useLeaving(onToggle)
  const [settle, setSettle] = useState<'down' | 'up' | null>(null)
  const was = useRef(done)
  useEffect(() => {
    exit.reset()
    if (was.current === done) return
    was.current = done
    if (!stay) return
    setSettle(done ? 'down' : 'up')
    const t = setTimeout(() => setSettle(null), 320)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])
  const toggle = (): void => (stay ? onToggle?.() : exit.toggle(done ? 'undo' : 'done'))
  const back = useTasks((st) => (id ? st.reopened.includes(id) : false))
  const shownDone = exit.leaving === 'undo' ? false : exit.leaving === 'done' ? true : !!done
  return (
    <div
      className={cn('task', shownDone && 'done', exit.leaving === 'done' && 'leaving', exit.leaving === 'undo' && 'leaving-up', !!settle && `settle-${settle}`, back && !stay && 'enter-up', compact && 'compact', last && 'last', enter && !back && 'enter', onOpen && 'clickable')}
      onClick={onOpen}
      {...(drag ? dragProps(drag) : null)}
    >
      <Checkbox
        checked={shownDone}
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
