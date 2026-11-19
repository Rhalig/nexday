import { GhostInput, type GhostTask, type Suggestion } from './GhostInput'

type Props = {
  placeholder: string
  button: string
  hint: string
  onSubmit?: (text: string) => void
  /** Example lines the empty bar types out while nobody is using it */
  suggestions?: Suggestion[]
  onTask?: (t: GhostTask | null) => void
  /** Sticks to the bottom of long pages */
  sticky?: boolean
}

/** The one capture bar every page uses. */
export function QuickCapture({ placeholder, button, hint, onSubmit, suggestions, onTask, sticky }: Props): React.JSX.Element {
  return (
    <div className={sticky ? 'capture sticky' : 'capture'}>
      <GhostInput placeholder={placeholder} button={button} onSubmit={onSubmit} suggestions={suggestions} onTask={onTask} />
      <span className="muted" style={{ paddingLeft: 18, fontSize: 12 }}>
        {hint}
      </span>
    </div>
  )
}
