import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Button, Kbd } from '../../components/ui'
import { useNotes } from '../../store/notes'
import { useTasks } from '../../store/tasks'
import { aiNoteActions } from '../../lib/ai'
import { actionItems, noteText, removeLine, setTodoState } from '../../lib/noteText'
import { useUI } from '../../store/ui'
import { FormatButtons, NoteBody, type FormatState, type NoteBodyHandle } from './NoteBody'
import { appToday, clockTime } from '../../lib/clock'
import type { Note } from '../../data/notes'
import './notes.css'

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
  const [confirmDel, setConfirmDel] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const bodyRef = useRef<NoteBodyHandle>(null)
  const [newItem, setNewItem] = useState('')
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, kind: null })
  const [initial] = useState(() => noteText(note))
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

  const onBody = (t: string): void => {
    setText(t)
    setDirty(true)
  }
  /** A change from outside the writing surface (AI, the side list). */
  const edit = (next: string): void => {
    bodyRef.current?.setText(next)
    setText(next)
    setDirty(true)
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
    // Put them in the day: the Auto-schedule preview opens with these tasks waiting for a slot.
    if (open.length) useUI.getState().openDialog('autoSchedule')
  }

  const addItem = (): void => {
    const t = newItem.trim().slice(0, 200)
    if (!t) return
    edit(`${text.replace(/\s+$/, '')}${text.trim() ? '\n' : ''}[ ] ${t}`)
    setNewItem('')
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
                  bodyRef.current?.focus()
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

            <div onBlur={flush} style={{ marginTop: 30 }}>
              <NoteBody ref={bodyRef} value={initial} onChange={onBody} onFormat={setFmt} placeholder="Start writing…  Type / for commands" />
            </div>
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
                          background: a.state === 'done' ? 'var(--acc)' : 'transparent',
                          borderColor: a.state === 'open' ? undefined : 'var(--acc)',
                          color: a.state === 'sent' ? 'var(--acc)' : '#fff',
                          padding: 0
                        }}
                      >
                        {a.state === 'done' && <Icon name="check" size={11} strokeWidth={3.2} />}
                        {a.state === 'sent' && <Icon name="arrowRight" size={11} strokeWidth={2.6} />}
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
                      <button
                        className="ed-x"
                        aria-label="Remove action item"
                        title="Remove from the note"
                        onClick={() => edit(removeLine(text, a.index))}
                      >
                        <Icon name="x" size={12} strokeWidth={2} round />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="row ed-add" style={{ marginTop: 8 }}>
                <Icon name="plus" size={14} strokeWidth={2} round />
                <input
                  className="ed-add-in"
                  value={newItem}
                  placeholder="Add an action item"
                  maxLength={200}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                />
              </div>
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

      <div className="fmt-bar" onMouseDown={(e) => e.preventDefault()}>
        <FormatButtons api={bodyRef} state={fmt} />
        <span className="tb-sep" />
        <span style={{ fontSize: 12.5, color: 'var(--ink3)', padding: '0 6px 0 4px' }}>Type</span>
        <Kbd mono>/</Kbd>
        <span style={{ fontSize: 12.5, color: 'var(--ink3)', paddingRight: 4 }}>for commands</span>
      </div>
    </main>
  )
}
