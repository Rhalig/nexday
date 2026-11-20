import { useEffect, useRef, useState } from 'react'

export type Exit = 'done' | 'undo' | null

/**
 * Ticking a task: the row shows the new state and slides out before `finish` really changes it.
 * Ticking ('done') slides it away to the side; unticking ('undo') slides it up, towards the open list.
 * Only the app's own "Reduce motion" preference skips the wait; the system setting makes it a fade.
 */
export function useLeaving(finish?: () => void, ms = 340): { leaving: Exit; toggle: (kind: 'done' | 'undo') => void; reset: () => void } {
  const [leaving, setLeaving] = useState<Exit>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const toggle = (kind: 'done' | 'undo'): void => {
    if (leaving) return
    if (document.documentElement.dataset.reduceMotion === 'true') return finish?.()
    setLeaving(kind)
    timer.current = setTimeout(() => finish?.(), ms)
  }
  return { leaving, toggle, reset: () => setLeaving(null) }
}
