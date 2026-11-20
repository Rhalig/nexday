import { useEffect, useRef, useState } from 'react'

/**
 * Finishing a task: the row shows it ticked and slides out before `finish` actually removes it.
 * Only the app's own "Reduce motion" preference skips the wait; the system setting just makes the exit a fade.
 */
export function useLeaving(finish?: () => void, ms = 340): { leaving: boolean; toggle: () => void } {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const toggle = (): void => {
    if (leaving) return
    if (document.documentElement.dataset.reduceMotion === 'true') return finish?.()
    setLeaving(true)
    timer.current = setTimeout(() => finish?.(), ms)
  }
  return { leaving, toggle }
}
