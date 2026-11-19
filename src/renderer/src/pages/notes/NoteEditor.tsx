import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { Button, Kbd } from '../../components/ui'
import { useNotes } from '../../store/notes'
import { useTasks } from '../../store/tasks'
import { useUI } from '../../store/ui'
import { aiNoteActions } from '../../lib/ai'
import { actionItems, noteText, parseLine, setTodoState } from '../../lib/noteText'
import { appToday, clockTime } from '../../lib/clock'
import type { Note } from '../../data/notes'
import './notes.css'

const commands: Array<{ icon: IconName; label: string; hint: string; prefix: string }> = [
  { icon: 'checkSquare', label: 'Action item', hint: '[ ]', prefix: '[ ] ' },
  { icon: 'list', label: 'Bulleted list', hint: '-', prefix: '- ' },
  { icon: 'heading', label: 'Heading', hint: '#', prefix: '# ' }
]

/** Start/end offsets of the line the caret is on. */
function lineAt(text: string, pos: number): { start: number; end: number } {
  const start = text.lastIndexOf('\n', pos - 1) + 1
  const nl = text.indexOf('\n', pos)
  return { start, end: nl === -1 ? text.length : nl }
}

const MARKER = /^(\s*)(\[( |x|X|>)\]\s?|[-*•]\s+|#{1,3}\s+)/

export default function NoteEditor(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const notes = useNotes((s) => s.notes)
  const note = notes.find((n) => n.id === id) ?? notes[0]

  if (!note) {
    return (
      <main className="panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span className="muted">This note no longer exists.</span>
        <Button onClick={() => navigate('/notes')}>Back to notes</Button>
      </main>
    )
  }
  // Keyed by id: opening another note starts with that note's own draft.
  return <Editor key={note.id} note={note} />
}

function Editor({ note }: { note: Note }): React.JSX.Element {
  const navigate = useNavigate()
  const [title, setTitle] = useState(note.title)
  const [text, setText] = useState(() => noteText(note))
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ query: string; index: number } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | null>(null)
  const latest = useRef({ title, text, dirty })
  latest.current = { title, text, dirty }

  const flush = (): void => {
    const cur = latest.current
    if (!cur.dirty) return
    useNotes.getState().update(note.id, {
      title: cur.title.trim() || 'Untitled note',
      text: cur.text
    })
    latest.current.dirty = false
    setDirty(false)
    setSavedAt(clockTime(appToday()))
  }

  // Save shortly after typing stops, and always when leaving the note.
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(flush, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, title, text])
  useEffect(() => flush, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Grow with the content; put the caret where an edit asked for it.
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(320, el.scrollHeight)}px`
    if (caret.current !== null) {
      el.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [text])

  const edit = (next: string, at?: number): void => {
    if (at !== undefined) caret.current = at
    setText(next)
    setDirty(true)
    setDismissed(false)
    syncMenu(next, at ?? area.current?.selectionStart ?? next.length)
  }

  /** The "/" menu shows while the caret line is just a slash and a word. */
  const syncMenu = (value: string, pos: number): void => {
    const { start, end } = lineAt(value, pos)
    const m = value.slice(start, end).match(/^\/(\w*)$/)
    setMenu(m ? { query: m[1].toLowerCase(), index: 0 } : null)
  }

  const shown = useMemo(
    () => (menu ? commands.filter((c) => c.label.toLowerCase().includes(menu.query)) : []),
    [menu]
  )
  const menuOpen = !!menu && !dismissed && shown.length > 0

  /** Puts a line prefix on the caret line, replacing any marker it already has. */
  const applyPrefix = (prefix: string): void => {
    const el = area.current
    const pos = el?.selectionStart ?? text.length
    const { start, end } = lineAt(text, pos)
    const line = text.slice(start, end)
    const bare = line.replace(MARKER, '').replace(/^\/\w*$/, '')
    const same = line.startsWith(prefix.trimEnd()) && MARKER.test(line)
    const nextLine = same ? bare : prefix + bare
    edit(text.slice(0, start) + nextLine + text.slice(end), start + nextLine.length)
    el?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (menuOpen && menu) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const d = e.key === 'ArrowDown' ? 1 : -1
        setMenu({ ...menu, index: (menu.index + d + shown.length) % shown.length })
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applyPrefix(shown[menu.index].prefix)
        setMenu(null)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissed(true)
        return
      }
    }
    // Enter keeps a list going; Enter on an empty marker ends it.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      const el = e.currentTarget
      if (el.selectionStart !== el.selectionEnd) return
      const pos = el.selectionStart
      const { start, end } = lineAt(text, pos)
      const line = text.slice(start, end)
      const parsed = parseLine(line)
      if (parsed.kind === 'bullet' || parsed.kind === 'todo') {
        e.preventDefault()
        if (!parsed.text.trim()) {
          edit(text.slice(0, start) + text.slice(end), start)
        } else {
          const marker = parsed.kind === 'bullet' ? '- ' : '[ ] '
          const lead = line.match(/^\s*/)?.[0] ?? ''
          const insert = `\n${lead}${marker}`
          edit(text.slice(0, pos) + insert + text.slice(pos), pos + insert.length)
        }
      }
    }
  }

  const items = actionItems(text)
  const open = items.filter((a) => a.state === 'open')

  const toggleItem = (index: number, state: 'open' | 'done' | 'sent'): void => {
    edit(setTodoState(text, index, state === 'done' ? 'open' : 'done'))
  }

  const addToPlan = (): void => {
    let next = text
    for (const a of open) {
      useTasks.getState().add(
        {
          id: crypto.randomUUID(),
          title: a.title,
          project: 'personal',
          energy: 'Light',
          time: null
        },
        'no-time'
      )
      next = setTodoState(next, a.index, 'sent')
    }
    edit(next)
  }

  const findActions = async (): Promise<void> => {
    setAiBusy(true)
    setAiError(null)
    const r = await aiNoteActions(title, text)
    setAiBusy(false)
    if ('error' in r) {
      setAiError(r.error)
      return
    }
    const known = new Set(items.map((a) => a.title.toLowerCase()))
    const fresh = r.data.items.filter((a) => !known.has(a.title.trim().toLowerCase()))
    if (fresh.length === 0) {
      setAiError(r.data.items.length === 0 ? 'No action items found.' : 'Those are already in the note.')
      return
    }
    edit(`${text.replace(/\s+$/, '')}${text.trim() ? '\n' : ''}${fresh.map((a) => `[ ] ${a.title}`).join('\n')}\n`)
  }

  const linkedTitle = note.linked?.replace(/^Linked to /, '').split(' · ')[0]
  const linkedTime = note.linked?.split(' · ')[1]
  const status = dirty ? 'Saving…' : savedAt ? `Saved · ${savedAt}` : 'Saved'

  return (
    <main className="panel" style={{ position: 'relative' }}>
      <div className="topbar" style={{ height: 36 }}>
        <div className="crumbs" style={{ gap: 8 }}>
          <Icon name="notes" size={15} strokeWidth={1.7} round />
          <span>Notes</span>
          <span style={{ color: '#BDBDBA' }}>/</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{title.trim() || 'Untitled note'}</span>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{status}</span>
          <Button
            onClick={() => {
              flush()
              navigate('/notes')
            }}
          >
            Back to notes
          </Button>
          {confirmDel ? (
            <>
              <Button onClick={() => setConfirmDel(false)}>Keep</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  latest.current.dirty = false
                  useNotes.getState().remove(note.id)
                  navigate('/notes')
                }}
              >
                Delete note
              </Button>
            </>
          ) : (
            <Button onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={15} />
            </Button>
          )}
          <Button
            variant="dark"
            onClick={() => {
              flush()
              const nid = useNotes.getState().add('Untitled note')
              if (!nid) {
                useUI.getState().openDialog('upgrade', 'notes')
                return
              }
              navigate(`/notes/${nid}`)
            }}
          >
            + New
          </Button>
        </div>
      </div>

      <div className="panel-scroll">
        <div className="ed-wrap">
          <div className="ed-main">
            {note.linked && (
              <div className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--acc)' }} />
                {note.linked}
              </div>
            )}
            <input
              className="ed-title"
              value={title}
              placeholder="Untitled note"
              onChange={(e) => {
                setTitle(e.target.value)
                setDirty(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  area.current?.focus()
                }
              }}
              style={{ border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: 32, fontWeight: 500, padding: 0, width: '100%' }}
            />
            <div className="row" style={{ gap: 8, fontSize: 13, color: 'var(--ink3)', marginTop: 10 }}>
              <span>{note.edited}</span>
              <span>·</span>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: note.chip.color }} />
              <span>{note.chip.name}</span>
            </div>

            <textarea
              ref={area}
              className="ed-area"
              value={text}
              placeholder="Start writing…  Type / for commands"
              spellCheck
              onChange={(e) => edit(e.target.value, e.target.selectionStart)}
              onKeyDown={onKeyDown}
              onKeyUp={(e) => {
                if (e.key.startsWith('Arrow') && !menuOpen) syncMenu(text, e.currentTarget.selectionStart)
              }}
              onClick={(e) => syncMenu(text, e.currentTarget.selectionStart)}
              onBlur={flush}
            />

            {menuOpen && menu && (
              <div className="slash">
                <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 16px 4px' }}>Add to note</div>
                {shown.map((c, i) => (
                  <div
                    className={i === menu.index ? 'sm on' : 'sm'}
                    key={c.label}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applyPrefix(c.prefix)
                      setMenu(null)
                    }}
                  >
                    <Icon name={c.icon} strokeWidth={1.7} round />
                    {c.label}
                    <span className="h">{c.hint}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ed-side">
            <div className="found">
              <div className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#F38020">
                  <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
                </svg>
                Action items
              </div>
              <span style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>
                {[
                  `${open.length} open`,
                  items.some((a) => a.state === 'done') && `${items.filter((a) => a.state === 'done').length} done`,
                  items.some((a) => a.state === 'sent') && `${items.filter((a) => a.state === 'sent').length} in plan`
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
                {items.length === 0
                  ? 'Start a line with [ ] to make an action item.'
                  : 'Lines starting with [ ] in your note.'}
              </span>
              {items.length > 0 && (
                <div className="col" style={{ marginTop: 8 }}>
                  {items.map((a, i, arr) => (
                    <div
                      className={`ed-rl${i === 0 ? ' top' : ''}${i === arr.length - 1 ? ' last' : ''}`}
                      key={a.index}
                    >
                      <button
                        className="cb18"
                        aria-label={a.state === 'done' ? 'Mark open' : 'Mark done'}
                        disabled={a.state === 'sent'}
                        onClick={() => toggleItem(a.index, a.state)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: a.state === 'open' ? 'transparent' : 'var(--acc)',
                          borderColor: a.state === 'open' ? undefined : 'var(--acc)',
                          color: '#fff',
                          padding: 0
                        }}
                      >
                        {a.state !== 'open' && <Icon name="check" size={11} strokeWidth={3.2} />}
                      </button>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textDecoration: a.state === 'done' ? 'line-through' : undefined,
                          color: a.state === 'open' ? undefined : 'var(--ink3)'
                        }}
                      >
                        {a.title}
                      </span>
                      {a.state === 'sent' && <span className="m">In plan</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="row" style={{ marginTop: 10, gap: 8, justifyContent: 'space-between' }}>
                <Button onClick={() => void findActions()} disabled={aiBusy}>
                  {aiBusy ? 'Looking…' : 'Find with AI'}
                </Button>
                <Button variant="dark" onClick={addToPlan} disabled={open.length === 0}>
                  Add {open.length || ''} to plan
                </Button>
              </div>
              {aiError && (
                <span style={{ fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5, marginTop: 6 }}>{aiError}</span>
              )}
              {open.length > 0 && (
                <span className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  They go to “No time yet”; Auto-schedule can place them.
                </span>
              )}
            </div>

            {linkedTitle && (
              <>
                <div className="ed-rh" style={{ paddingTop: 30 }}>
                  Linked event
                </div>
                <div className="ed-rl top">
                  <span style={{ width: 3, height: 22, borderRadius: 2, background: '#4A78D4' }} />
                  <span>{linkedTitle}</span>
                  <span style={{ flex: 1 }} />
                  {linkedTime && <span className="m">{linkedTime}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fmt-bar">
        <button className="tb" aria-label="Heading" onClick={() => applyPrefix('# ')}>
          <Icon name="heading" strokeWidth={1.7} round />
        </button>
        <button className="tb" aria-label="Bulleted list" onClick={() => applyPrefix('- ')}>
          <Icon name="list" strokeWidth={1.7} round />
        </button>
        <button className="tb" aria-label="Action item" onClick={() => applyPrefix('[ ] ')}>
          <Icon name="checkSquare" strokeWidth={1.7} round />
        </button>
        <span className="tb-sep" />
        <span style={{ fontSize: 12.5, color: 'var(--ink3)', padding: '0 6px 0 4px' }}>Type</span>
        <Kbd mono>/</Kbd>
        <span style={{ fontSize: 12.5, color: 'var(--ink3)', paddingRight: 4 }}>for commands</span>
      </div>
    </main>
  )
}
