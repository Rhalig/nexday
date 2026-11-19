import { useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'

/**
 * Drag and drop for the day grids. Plain HTML5 dragging: the thing being dragged is described in
 * a module variable (dragover cannot read dataTransfer), and a TimelineDrop turns the pointer's
 * height into a time, snapped to a quarter hour, with a ghost block showing where it will land.
 */

export type Dragged = {
  kind: 'event' | 'task'
  id: string
  title: string
  /** Pointer position inside the dragged element when the drag began, in px from its top */
  offsetY: number
  /** Length in minutes, for the ghost block and for keeping an event's length */
  minutes: number
}

let current: Dragged | null = null
export const dragging = (): Dragged | null => current

export function dragProps(
  d: Omit<Dragged, 'offsetY'>,
  enabled = true
): {
  draggable: boolean
  onDragStart?: (e: DragEvent<HTMLElement>) => void
  onDragEnd?: () => void
} {
  if (!enabled) return { draggable: false }
  return {
    draggable: true,
    onDragStart: (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      current = { ...d, offsetY: e.clientY - rect.top }
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', d.title)
    },
    onDragEnd: () => {
      current = null
    }
  }
}

const snapTo = (min: number, step: number): number => Math.round(min / step) * step

export function clockOf(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** A column of a time grid that accepts drops. `children` are the absolutely placed items. */
export function TimelineDrop({
  className,
  style,
  pxPerHour,
  startHour,
  endHour = 24,
  topOffset = 0,
  accepts,
  onDropAt,
  children
}: {
  className?: string
  style?: CSSProperties
  pxPerHour: number
  /** Hour at the top of the column */
  startHour: number
  endHour?: number
  /** Extra pixels between the top of the column and startHour */
  topOffset?: number
  accepts: (d: Dragged) => boolean
  /** Minutes from midnight, snapped and clamped so the item fits */
  onDropAt: (d: Dragged, startMin: number) => void
  children: ReactNode
}): React.JSX.Element {
  const [ghost, setGhost] = useState<{ min: number; d: Dragged } | null>(null)

  const place = (e: DragEvent<HTMLElement>, d: Dragged): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top - d.offsetY - topOffset
    const raw = startHour * 60 + (y / pxPerHour) * 60
    const max = endHour * 60 - Math.min(d.minutes, 60)
    return Math.max(startHour * 60, Math.min(max, snapTo(raw, 15)))
  }

  return (
    <div
      className={className}
      style={style}
      onDragOver={(e) => {
        const d = current
        if (!d || !accepts(d)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const min = place(e, d)
        if (!ghost || ghost.min !== min || ghost.d !== d) setGhost({ min, d })
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setGhost(null)
      }}
      onDrop={(e) => {
        const d = current
        setGhost(null)
        if (!d || !accepts(d)) return
        e.preventDefault()
        onDropAt(d, place(e, d))
        current = null
      }}
    >
      {children}
      {ghost && (
        <div
          style={{
            position: 'absolute',
            left: 4,
            right: 6,
            top: topOffset + ((ghost.min - startHour * 60) / 60) * pxPerHour,
            height: Math.max(22, (ghost.d.minutes / 60) * pxPerHour - 2),
            border: '1.5px dashed var(--acc)',
            background: 'var(--acc-soft)',
            borderRadius: 10,
            pointerEvents: 'none',
            fontSize: 11.5,
            fontWeight: 500,
            color: 'var(--acc-text)',
            padding: '3px 8px',
            overflow: 'hidden',
            zIndex: 5
          }}
        >
          {clockOf(ghost.min)}
        </div>
      )}
    </div>
  )
}

/** A box that takes dropped cards (board columns, task groups). */
export function CardDrop({
  className,
  highlightClass = 'drop-on',
  accepts,
  onDropCard,
  children
}: {
  className?: string
  highlightClass?: string
  accepts: (d: Dragged) => boolean
  onDropCard: (d: Dragged) => void
  children: ReactNode
}): React.JSX.Element {
  const [over, setOver] = useState(false)
  return (
    <div
      className={[className, over ? highlightClass : ''].filter(Boolean).join(' ')}
      onDragOver={(e) => {
        const d = current
        if (!d || !accepts(d)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!over) setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        const d = current
        setOver(false)
        if (!d || !accepts(d)) return
        e.preventDefault()
        onDropCard(d)
        current = null
      }}
    >
      {children}
    </div>
  )
}
