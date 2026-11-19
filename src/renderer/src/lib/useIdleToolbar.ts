import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A toolbar that is only there while the person is writing: any typing or caret movement calls
 * `bump()`, and it fades away a moment after the last one (hovering it keeps it).
 */
export function useIdleToolbar(idleMs = 1800): {
  hidden: boolean
  bump: () => void
  hover: { onMouseEnter: () => void; onMouseLeave: () => void }
} {
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const held = useRef(false)

  const arm = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!held.current) setShown(false)
    }, idleMs)
  }, [idleMs])

  const bump = useCallback(() => {
    setShown(true)
    arm()
  }, [arm])

  useEffect(() => () => clearTimeout(timer.current), [])

  return {
    hidden: !shown,
    bump,
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
