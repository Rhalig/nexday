import { useEffect, type ReactNode } from 'react'

/**
 * Dimmed, blurred scrim with a centred modal that sits 150px from the top.
 * Clicking the scrim or pressing Escape closes it.
 */
export function Overlay({
  children,
  onClose,
  top = 150,
  instant = false
}: {
  children: ReactNode
  onClose: () => void
  /** Distance from the top of the window, 150px unless the design says otherwise */
  top?: number
  /** Opened from a keyboard shortcut many times a day: no motion */
  instant?: boolean
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className={instant ? 'overlay instant' : 'overlay'} style={{ paddingTop: top }} onMouseDown={onClose}>
      <div className="overlay-box" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
