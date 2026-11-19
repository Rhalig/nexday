import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { NOTE_SUGGESTIONS } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { Button, GroupHeader, Segmented, cn } from '../../components/ui'
import { useUI } from '../../store/ui'
import { useNotes } from '../../store/notes'
import { pageDate } from '../../lib/clock'
import { noteTabs, type Note, type NoteCategory } from '../../data/notes'
import { actionItems, noteText, openActionCount } from '../../lib/noteText'
import { ConfirmDialog } from '../../components/DrawerParts'
import { FormatButtons, NoteBody, type FormatState, type NoteBodyHandle } from './NoteBody'
import './notes.css'

type Filter = 'all' | NoteCategory

const groups: Array<{ id: Note['group']; title: string }> = [
  { id: 'today', title: 'Today' },
  { id: 'week', title: 'This week' }
]

export default function Notes(): React.JSX.Element {
  const navigate = useNavigate()
  const notes = useNotes((s) => s.notes)
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState('')
  const [ctx, setCtx] = useState<{ x: number; y: number; id: string } | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)

  const visible = filter === 'all' ? notes : notes.filter((n) => n.category === filter)
  const selected = notes.find((n) => n.id === selectedId) ?? visible[0] ?? notes[0]
  const linked = notes.filter((n) => n.linked).length
  const actions = notes.reduce((n, x) => n + openActionCount(x), 0)
  const tabs = noteTabs.map((t) => ({
    ...t,
    count: t.id === 'all' ? notes.length : notes.filter((n) => n.category === t.id).length
  }))

  return (
    <main className="panel">
      <Topbar icon="notes" section="Notes" current={selected?.title ?? 'All notes'} />

      <div className="panel-scroll">
        <PageHead
          date={pageDate()}
          title="Notes"
          sub={`${notes.length} notes. ${linked} are linked to events on your calendar today.`}
          stats={[
            ['Notes', String(notes.length)],
            ['Linked to events', String(linked)],
            ['Open action items', String(actions)]
          ]}
        />

        <div className="notes-toolbar">
          <Segmented items={tabs} value={filter} onChange={setFilter} />
          <div className="row" style={{ gap: 10 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              <span
                style={{ color: '#1A1A1A', fontWeight: 500, marginRight: 18, cursor: 'pointer' }}
                onClick={() => useUI.getState().openDialog('templates')}
              >
                Templates
              </span>
              Sorted by last edited
            </span>
          </div>
        </div>

        {notes.length === 0 && (
          <div className="notes-empty">
            <span style={{ color: '#BDBDBA', display: 'flex' }}>
              <Icon name="noteLines" size={44} strokeWidth={1.4} round />
            </span>
            <h2>No notes yet</h2>
            <p>
              Write your first note below. Nexday links it to events on your calendar and pulls out
              the tasks hiding inside.
            </p>
          </div>
        )}

        {notes.length > 0 && (
          <div className="notes-body">
            <section className="notes-list">
              {groups.map((g) => {
                const list = visible.filter((n) => n.group === g.id)
                if (list.length === 0) return null
                return (
                  <div className="col" key={g.id}>
                    <GroupHeader title={g.title} meta={String(list.length)} padTop={20} />
                    {list.map((n) => (
                      <button
                        key={n.id}
                        className={cn('note', n.id === selected?.id && 'on')}
                        onClick={() => setSelectedId(n.id)}
                        onDoubleClick={() => navigate(`/notes/${n.id}`)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setSelectedId(n.id)
                          setCtx({ x: e.clientX, y: e.clientY, id: n.id })
                        }}
                      >
                        <span className="nt">{n.title}</span>
                        <span className="ns">{n.summary}</span>
                        <div className="nm">
                          <div className="swatch" style={{ background: n.chip.color }} />
                          <span>{n.chip.name}</span>
                          <span>·</span>
                          <span className={n.when.mono ? 'mono' : undefined}>{n.when.text}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              })}
            </section>

            {selected && (
              <Preview
                key={selected.id}
                note={selected}
                onOpen={() => navigate(`/notes/${selected.id}`)}
                onDelete={() => setDeleting(selected)}
              />
            )}
          </div>
        )}
      </div>

      <QuickCapture
        suggestions={NOTE_SUGGESTIONS}
        placeholder={'Write a note… "meeting with Ece, link to Design critique"'}
        button="Save"
        hint="Notes link to events on their own, and Nexday pulls out the tasks hiding inside."
        onSubmit={(text) => {
          const id = useNotes.getState().add(text)
          setSelectedId(id)
        }}
      />
      {ctx && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onMouseDown={() => setCtx(null)} onContextMenu={(e) => { e.preventDefault(); setCtx(null) }} />
          <div className="note-ctx" style={{ left: Math.min(ctx.x, window.innerWidth - 190), top: Math.min(ctx.y, window.innerHeight - 100) }}>
            <button
              onClick={() => {
                navigate(`/notes/${ctx.id}`)
                setCtx(null)
              }}
            >
              Open
            </button>
            <button
              className="danger"
              onClick={() => {
                setDeleting(notes.find((n) => n.id === ctx.id) ?? null)
                setCtx(null)
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this note?"
          body={<>“{deleting.title}” will be removed. This cannot be undone.</>}
          confirmLabel="Delete note"
          onConfirm={() => {
            useNotes.getState().remove(deleting.id)
            setDeleting(null)
            setSelectedId('')
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </main>
  )
}

function Preview({ note, onOpen, onDelete }: { note: Note; onOpen: () => void; onDelete: () => void }): React.JSX.Element {
  // Edited in place: the title and the text save a moment after typing stops.
  const [title, setTitle] = useState(note.title)
  const [initial] = useState(() => noteText(note))
  const latest = useRef({ title: note.title, text: initial, dirty: false })
  const bodyRef = useRef<NoteBodyHandle>(null)
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, kind: null })
  const items = actionItems(latest.current.text)
  const [open, setOpen] = useState(items.filter((a) => a.state === 'open').length)
  const save = (): void => {
    const c = latest.current
    if (!c.dirty) return
    c.dirty = false
    useNotes.getState().update(note.id, { title: c.title.trim() || 'Untitled note', text: c.text })
  }
  useEffect(() => {
    const t = setInterval(save, 700)
    return () => {
      clearInterval(t)
      save()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <article className="preview">
      {note.linked && (
        <div className="row" style={{ gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--acc)',
              boxShadow: '0 0 0 4px var(--acc-soft)'
            }}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            {note.linked}
          </span>
        </div>
      )}
      <input
        className="pv-title"
        value={title}
        placeholder="Untitled note"
        onChange={(e) => {
          setTitle(e.target.value)
          latest.current.title = e.target.value
          latest.current.dirty = true
        }}
      />
      <div className="row muted" style={{ gap: 8, fontSize: 12.5, marginTop: 4 }}>
        <span>{note.edited}</span>
        <span>·</span>
        <div className="swatch" style={{ background: note.chip.color }} />
        <span>{note.chip.name}</span>
      </div>

      <div style={{ marginTop: 22 }}>
        <NoteBody
          ref={bodyRef}
          onFormat={setFmt}
          value={initial}
          compact
          placeholder="Start writing…  Type / for commands"
          onChange={(t) => {
            latest.current.text = t
            latest.current.dirty = true
            setOpen(actionItems(t).filter((a) => a.state === 'open').length)
          }}
        />
      </div>

      <div className="row" style={{ marginTop: 24, gap: 8 }}>
        <div className="nb-tools" style={{ marginTop: 0 }}>
          <FormatButtons api={bodyRef} state={fmt} />
        </div>
        {open > 0 && (
          <>
            <span style={{ color: '#E2680C', display: 'flex' }}>
              <Icon name="bolt" size={14} strokeWidth={2} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {open} open action {open === 1 ? 'item' : 'items'}
            </span>
          </>
        )}
        <span style={{ flex: 1 }} />
        <Button onClick={onDelete}>
          <Icon name="trash" size={15} />
        </Button>
        <Button
          onClick={() => {
            save()
            onOpen()
          }}
        >
          Open full page
        </Button>
      </div>
    </article>
  )
}
