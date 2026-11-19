import { useState } from 'react'
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

  const visible = filter === 'all' ? notes : notes.filter((n) => n.category === filter)
  const selected = notes.find((n) => n.id === selectedId) ?? visible[0] ?? notes[0]
  const linked = notes.filter((n) => n.linked).length
  const actions = notes.reduce((n, x) => n + (x.body?.actionItems.length ?? 0), 0)
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
              <Preview note={selected} onOpen={() => navigate(`/notes/${selected.id}`)} />
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
          if (!id) {
            useUI.getState().openDialog('upgrade', 'notes')
            return
          }
          setSelectedId(id)
        }}
      />
    </main>
  )
}

function Preview({ note, onOpen }: { note: Note; onOpen: () => void }): React.JSX.Element {
  const body = note.body
  return (
    <article className="preview" onDoubleClick={onOpen}>
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
      <h2>{note.title}</h2>
      <div className="row muted" style={{ gap: 8, fontSize: 12.5, marginTop: 4 }}>
        <span>{note.edited}</span>
        <span>·</span>
        <div className="swatch" style={{ background: note.chip.color }} />
        <span>{note.chip.name}</span>
      </div>

      {body ? (
        <>
          <div className="pv-section">
            <h3>Goals</h3>
            {body.goals.map((g) => (
              <div className="li" key={g}>
                <div className="dot-b" />
                <span>{g}</span>
              </div>
            ))}
          </div>

          <div className="pv-section">
            <h3>Open questions</h3>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: '#2A2A2A' }}>{body.questions}</p>
          </div>

          <div className="row" style={{ marginTop: 28, gap: 10, justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ color: '#E2680C', display: 'flex' }}>
                <Icon name="bolt" size={14} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                {body.actionItems.length} action items found
              </span>
            </div>
            <Button variant="dark">
              <span>Add all to plan</span>
            </Button>
          </div>
          <div className="col" style={{ marginTop: 6 }}>
            {body.actionItems.map((a, i) => (
              <div className={cn('ai', i === body.actionItems.length - 1 && 'last')} key={a.title}>
                <div className="cb" />
                <span style={{ flex: 1, fontSize: 14 }}>{a.title}</span>
                <span
                  className={cn('mono', !a.hot && 'muted')}
                  style={{
                    fontSize: 12.5,
                    ...(a.hot ? { color: 'var(--acc-text)', fontWeight: 500 } : null)
                  }}
                >
                  {a.time}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 15, lineHeight: 1.55, color: '#2A2A2A', marginTop: 22 }}>
          {note.summary}
        </p>
      )}
    </article>
  )
}
