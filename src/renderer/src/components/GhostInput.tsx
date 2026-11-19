import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Project } from '../data/tasks'
import { Kbd } from './ui'
import { useTasks } from '../store/tasks'
import { useProjects } from '../store/projects'
import './ghost.css'

export type GhostTask = { title: string; project: Project }

export type Suggestion = { typed: string; ghost: string; title: string; project: Project }

export const TASK_SUGGESTIONS: Suggestion[] = [
  { typed: 'Design critique notes', ghost: ' — link to Figma, 3 action items', title: 'Design critique notes — 3 action items', project: 'planner' },
  { typed: 'Send Mert the', ghost: ' updated component spec by 17:00', title: 'Send Mert the updated component spec', project: 'planner' },
  { typed: 'Book dentist', ghost: ' appointment for next week #personal', title: 'Book dentist appointment #personal', project: 'personal' },
  { typed: 'Review PR #48', ghost: ' — Ece requested this morning', title: "Review PR #48 — Ece's request", project: 'moving' },
  { typed: 'Plan sprint', ghost: ' retrospective for Friday afternoon', title: 'Plan sprint retrospective Friday', project: 'reading' }
]

const s = (typed: string, ghost: string, project: Project = 'planner'): Suggestion => ({ typed, ghost, title: typed + ghost, project })

export const INBOX_SUGGESTIONS: Suggestion[] = [
  s('Call the landlord', ' about the deposit next week #personal', 'personal'),
  s('Idea: a weekly review', ' template with a score'),
  s('Reply to Mert', ' about the component spec before Friday')
]
export const NOTE_SUGGESTIONS: Suggestion[] = [
  s('Meeting with Ece', ', link to Design critique'),
  s('Sprint retro notes', ': what to keep, what to drop'),
  s('Chapter 5 thoughts', ' for book club', 'reading')
]
export const HABIT_SUGGESTIONS: Suggestion[] = [
  s('Drink water', ' every 2 hours from 09:00', 'personal'),
  s('Stretch 10 min', ' every morning at 07:45', 'personal'),
  s('Read 20 pages', ' every evening after dinner', 'reading')
]

const DAY_WORDS = ['tomorrow', 'today', 'next week', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const PROJECT_TAGS = ['planner', 'moving', 'reading', 'personal']

/**
 * Quick-capture input. Letters fade in as they are typed; Tab accepts the grey completion.
 * (The suggestion lists only feed the completion; there is no demo animation.)
 */
export function GhostInput({
  onSubmit,
  suggestions = TASK_SUGGESTIONS,
  placeholder = 'Type anything… "coffee with Ece tomorrow 15:00 #personal"',
  button = 'Send'
}: {
  /** Kept for callers that still pass it; the demo that used it is gone */
  onTask?: (t: GhostTask | null) => void
  onSubmit?: (text: string) => void
  suggestions?: Suggestion[]
  placeholder?: string
  button?: string
}): React.JSX.Element {
  const SUGGESTIONS = suggestions
  const [value, setValue] = useState('')
  const groups = useTasks((st) => st.groups)
  const customProjects = useProjects((st) => st.custom)
  // What Tab would add: a #project, a whole line you wrote before or that is suggested, or a day word.
  const completion = useMemo((): string => {
    const v = value
    if (v.trim().length < 2) return ''
    const tag = v.match(/(?:^|\s)#([\w-]*)$/)
    if (tag) {
      const pool = [...PROJECT_TAGS, ...customProjects.map((c) => c.slug)]
      const hit = pool.find((t) => t.startsWith(tag[1].toLowerCase()) && t.length > tag[1].length)
      return hit ? hit.slice(tag[1].length) : ''
    }
    const lower = v.toLowerCase()
    const lines = [...SUGGESTIONS.map((x) => x.typed + x.ghost), ...groups.flatMap((g) => g.tasks.map((t) => t.title))]
    const line = lines.find((l) => l.length > v.length && l.toLowerCase().startsWith(lower))
    if (line) return line.slice(v.length)
    const word = v.match(/(?:^|\s)([a-z]{2,})$/i)
    if (word) {
      const w = word[1].toLowerCase()
      const day = DAY_WORDS.find((d) => d.startsWith(w) && d.length > w.length)
      if (day) return day.slice(w.length)
    }
    return ''
  }, [value, groups, customProjects, SUGGESTIONS])
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [animFrom, setAnimFrom] = useState(Infinity)
  const echoRef = useRef<HTMLDivElement>(null)
  // The visible text is drawn here, letter by letter, so new letters can animate; the real input keeps the caret.
  const syncScroll = (): void => {
    if (echoRef.current && inputRef.current) echoRef.current.style.transform = `translateX(${-inputRef.current.scrollLeft}px)`
  }
  useLayoutEffect(syncScroll, [value])
  const submit = (): void => {
    const text = value.trim()
    if (!text) return
    onSubmit?.(text)
    setValue('')
  }
  return (
    <div className="gs-wrap">
      <div className="gs-inner">
        <div className="gs-body" onMouseDown={() => inputRef.current?.focus()}>
          <input
            ref={inputRef}
            className="gs-input"
            value={value}
            onChange={(e) => {
              setAnimFrom(e.target.value.length > value.length ? value.length : Infinity)
              setValue(e.target.value)
            }}
            onScroll={syncScroll}
            onKeyUp={syncScroll}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              else if ((e.key === 'Tab' || (e.key === 'ArrowRight' && e.currentTarget.selectionStart === value.length)) && completion) {
                e.preventDefault()
                setAnimFrom(value.length)
                setValue(value + completion)
              }
            }}
            aria-label={placeholder}
          />
          {focused && completion && (
            <div className="gs-auto" aria-hidden>
              <span style={{ visibility: 'hidden', whiteSpace: 'pre' }}>{value}</span>
              <span className="gs-auto-t" style={{ whiteSpace: 'pre' }}>{completion}</span>
              <span className="gs-tab" style={{ opacity: 1 }}>
                Tab ↵
              </span>
            </div>
          )}
          <div className="gs-echo" aria-hidden>
            <div ref={echoRef} style={{ whiteSpace: 'pre' }}>
              {value.split('').map((ch, n) => (
                <span key={n} className={n >= animFrom ? 'gs-ch in' : 'gs-ch'} style={n >= animFrom ? { animationDelay: `${Math.min((n - animFrom) * 12, 120)}ms` } : undefined}>
                  {ch}
                </span>
              ))}
            </div>
          </div>
          <div className="gs-placeholder" style={{ opacity: value !== '' ? 0 : 1 }}>
            {placeholder}
          </div>
        </div>
        <button className="gs-send" onClick={submit}>
          <span>{button}</span>
        </button>
        <Kbd>⌘K</Kbd>
      </div>
    </div>
  )
}
