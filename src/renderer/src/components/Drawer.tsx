import { useEffect, type ReactNode } from 'react'

/**
 * Right-hand detail drawer. The page underneath stays visible (the design
 * does not dim it); clicking outside or pressing Escape closes it.
 */
export function Drawer({ children, onClose, width = 540 }: { children: ReactNode; onClose: () => void; width?: number }): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" style={{ width }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
