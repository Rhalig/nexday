import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * A toolbar that is only there while the person is writing: any typing or caret movement calls
 * `bump()`, and it fades away a moment after the last one (hovering it keeps it).
 */
export function useIdleToolbar(idleMs = 1800): {
  hidden: boolean
  bump: () => void
  /** Put on the element the bar floats inside (position: relative) */
  wrapRef: RefObject<HTMLDivElement | null>
  /** Where the bar sits inside that element: just under the line being written */
  top: number
  hover: { onMouseEnter: () => void; onMouseLeave: () => void }
} {
  const [shown, setShown] = useState(false)
  const [top, setTop] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const held = useRef(false)

  const arm = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!held.current) setShown(false)
    }, idleMs)
  }, [idleMs])

  const bump = useCallback(() => {
    // Float just below the line the caret is on
    const node = window.getSelection()?.anchorNode
    const el = (node instanceof Element ? node : node?.parentElement)?.closest('.nb-row') as HTMLElement | null
    const wrap = wrapRef.current
    if (el && wrap && wrap.contains(el)) setTop(el.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top + 6)
    setShown(true)
    arm()
  }, [arm])

  useEffect(() => () => clearTimeout(timer.current), [])

  return {
    hidden: !shown,
    bump,
    wrapRef,
    top,
    hover: {
      onMouseEnter: () => {
        held.current = true
        clearTimeout(timer.current)
        setShown(true)
      },
      onMouseLeave: () => {
        held.current = false
        arm()
      }
    }
  }
}
