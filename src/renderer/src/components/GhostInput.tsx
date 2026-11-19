import { useEffect, useMemo, useRef, useState } from 'react'
import type { Project } from '../data/tasks'
import { Kbd, cn } from './ui'
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

type Phase = 'idle' | 'typing' | 'ghost' | 'accept' | 'task' | 'pause'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Quick-capture input with an animated AI suggestion loop:
 * placeholder → typing → ghost completion → accept (Tab) → task appears → reset.
 */
export function GhostInput({
  onTask,
  onSubmit,
  suggestions = TASK_SUGGESTIONS,
  placeholder = 'Type anything… "coffee with Ece tomorrow 15:00 #personal"',
  button = 'Send'
}: {
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
  // The suggestion demo only plays while nobody is typing
  const demo = !focused && value === ''
  const submit = (): void => {
    const text = value.trim()
    if (!text) return
    onSubmit?.(text)
    setValue('')
  }
  const [phase, setPhase] = useState<Phase>('idle')
  const [idx, setIdx] = useState(0)
  const [typed, setTyped] = useState(0)
  const [ghost, setGhost] = useState(0)
  const [hop, setHop] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async (): Promise<void> => {
      let i = 0
      while (!cancelled) {
        const s = SUGGESTIONS[i % SUGGESTIONS.length]
        setIdx(i % SUGGESTIONS.length)
        setPhase('idle')
        setTyped(0)
        setGhost(0)
        setHop(0)
        await sleep(5400)
        if (cancelled) return
        setPhase('typing')
        for (let c = 1; c <= s.typed.length; c++) {
          setTyped(c)
          await sleep(75)
          if (cancelled) return
        }
        await sleep(400)
        setPhase('ghost')
        for (let c = 1; c <= s.ghost.length; c++) {
          setGhost(c)
          await sleep(40)
          if (cancelled) return
        }
        await sleep(1000)
        setPhase('accept')
        for (let c = 1; c <= s.ghost.length; c++) {
          setHop(c)
          await sleep(35)
          if (cancelled) return
        }
        await sleep(500)
        setPhase('task')
        onTask?.({ title: s.title, project: s.project })
        await sleep(2000)
        if (cancelled) return
        setPhase('pause')
        await sleep(7000)
        onTask?.(null)
        i++
      }
    }
    void run()
    return () => {
      cancelled = true
      onTask?.(null)
    }
  }, [onTask, SUGGESTIONS])

  const s = SUGGESTIONS[idx]
  const lineVisible = phase === 'typing' || phase === 'ghost' || phase === 'accept'

  return (
    <div className="gs-wrap">
      <div className="gs-inner">
        <div className="gs-body" onMouseDown={() => inputRef.current?.focus()}>
          <input
            ref={inputRef}
            className="gs-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              else if ((e.key === 'Tab' || (e.key === 'ArrowRight' && e.currentTarget.selectionStart === value.length)) && completion) {
                e.preventDefault()
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
          <div className="gs-placeholder" style={{ opacity: value !== '' ? 0 : !demo || phase === 'idle' ? 1 : 0 }}>
            {placeholder}
          </div>
          <div className="gs-line" style={{ opacity: demo && lineVisible ? 1 : 0 }}>
            <span className="gs-typed">{s.typed.slice(0, typed)}</span>
            {phase === 'typing' && <span className="gs-caret" />}
            <span className="gs-ghost">
              {s.ghost.split('').map((ch, n) => (
                <span key={n} className={cn('g', n < ghost && 'in', n < hop && 'hop')}>
                  {ch}
                </span>
              ))}
            </span>
            <span
              className="gs-tab"
              style={{ opacity: phase === 'ghost' ? 1 : 0, transform: phase === 'ghost' ? 'scale(1)' : 'scale(.6)' }}
            >
              Tab ↵
            </span>
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
