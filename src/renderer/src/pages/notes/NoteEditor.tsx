import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { Button, Kbd } from '../../components/ui'
import { useNotes } from '../../store/notes'
import { useTasks } from '../../store/tasks'
import { useUI } from '../../store/ui'
import { aiNoteActions, type AiActionItem } from '../../lib/ai'
import './notes.css'

const commands: Array<{ icon: IconName; label: string; hint: string }> = [
  { icon: 'checkSquare', label: 'Action item', hint: '[ ]' },
  { icon: 'list', label: 'Bulleted list', hint: '-' },
  { icon: 'heading', label: 'Heading', hint: '#' },
  { icon: 'calendarLg', label: 'Link an event', hint: '@' },
  { icon: 'squareRound', label: 'Link a project', hint: '+' }
]

export default function NoteEditor(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const notes = useNotes((s) => s.notes)
  const note = notes.find((n) => n.id === id) ?? notes[0]
  const [aiBusy, setAiBusy] = useState(false)
  const [aiItems, setAiItems] = useState<AiActionItem[]>([])
  const [aiError, setAiError] = useState<string | null>(null)

  if (!note) {
    return (
      <main className="panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span className="muted">This note no longer exists.</span>
        <Button onClick={() => navigate('/notes')}>Back to notes</Button>
      </main>
    )
  }

  const body = note.body
  const linkedTitle = note.linked?.replace(/^Linked to /, '').split(' · ')[0]
  const linkedTime = note.linked?.split(' · ')[1]

  const findActions = async (): Promise<void> => {
    setAiBusy(true)
    setAiError(null)
    const plain = [
      note.summary,
      ...(body?.goals ?? []),
      body?.questions ?? '',
      ...(body?.actionItems ?? []).map((a) => a.title)
    ]
      .filter(Boolean)
      .join('\n')
    const r = await aiNoteActions(note.title, plain)
    setAiBusy(false)
    if ('error' in r) {
      setAiError(r.error)
      return
    }
    setAiItems(r.data.items)
    if (r.data.items.length === 0) setAiError('No action items found.')
  }

  const addAllToPlan = (): void => {
    for (const item of aiItems) {
      useTasks.getState().add(
        {
          id: crypto.randomUUID(),
          title: item.title,
          project: 'personal',
          energy: 'Light',
          time: null
        },
        'no-time'
      )
    }
    setAiItems([])
  }

  return (
    <main className="panel" style={{ position: 'relative' }}>
      <div className="topbar" style={{ height: 36 }}>
        <div className="crumbs" style={{ gap: 8 }}>
          <Icon name="notes" size={15} strokeWidth={1.7} round />
          <span>Notes</span>
          <span style={{ color: '#BDBDBA' }}>/</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{note.title}</span>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Saved · just now</span>
          <Button onClick={() => navigate('/notes')}>Back to notes</Button>
          <Button
            variant="dark"
            onClick={() => {
              const id = useNotes.getState().add('Untitled note')
              if (!id) {
                useUI.getState().openDialog('upgrade', 'notes')
                return
              }
              navigate(`/notes/${id}`)
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
                <span
                  style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--acc)' }}
                />
                {note.linked}
              </div>
            )}
            <span className="ed-title">{note.title}</span>
            <div
              className="row"
              style={{ gap: 8, fontSize: 13, color: 'var(--ink3)', marginTop: 10 }}
            >
              <span>{note.edited}</span>
              <span>·</span>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: note.chip.color }} />
              <span>{note.chip.name}</span>
            </div>

            <div className="row" style={{ marginTop: 18, gap: 10, flexWrap: 'wrap' }}>
              <Button onClick={() => void findActions()} disabled={aiBusy}>
                {aiBusy ? 'Looking…' : 'Find action items'}
              </Button>
              {aiError && (
                <span style={{ fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5 }}>
                  {aiError}
                </span>
              )}
            </div>
            {aiItems.length > 0 && (
              <div className="col" style={{ marginTop: 12 }}>
                <div className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
                  <span style={{ color: '#E2680C', display: 'flex' }}>
                    <Icon name="bolt" size={14} strokeWidth={2} />
                  </span>
                  Nexday found {aiItems.length} action items
                </div>
                {aiItems.map((a) => (
                  <div
                    className="row"
                    key={a.title}
                    style={{
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--line)',
                      fontSize: 14
                    }}
                  >
                    <span className="dot-b" />
                    <span style={{ flex: 1 }}>{a.title}</span>
                    {a.when && (
                      <span className="mono muted" style={{ fontSize: 12.5 }}>
                        {a.when}
                      </span>
                    )}
                  </div>
                ))}
                <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    Added to “No time yet”; auto-schedule can place them.
                  </span>
                  <Button variant="dark" onClick={addAllToPlan}>
                    Add all to plan
                  </Button>
                </div>
              </div>
            )}

            {body ? (
              <>
                <span className="ed-h" style={{ marginTop: 34 }}>
                  Goals
                </span>
                <div className="col" style={{ marginTop: 8 }}>
                  {body.goals.map((g) => (
                    <div className="bl" key={g}>
                      <i />
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
                <span className="ed-h" style={{ marginTop: 30 }}>
                  Open questions
                </span>
                <span style={{ fontSize: 15.5, lineHeight: 1.6, marginTop: 10 }}>
                  {body.questions}
                </span>
                <div className="row" style={{ marginTop: 22, height: 28, fontSize: 15.5 }}>
                  <span>/</span>
                  <span className="caret" />
                </div>
                <div className="slash">
                  <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 16px 4px' }}>
                    Add to note
                  </div>
                  {commands.map((c, i) => (
                    <div className={i === 0 ? 'sm on' : 'sm'} key={c.label}>
                      <Icon name={c.icon} strokeWidth={1.7} round />
                      {c.label}
                      <span className="h">{c.hint}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <span
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.6,
                  marginTop: 34,
                  color: note.summary ? undefined : 'var(--ink3)'
                }}
              >
                {note.summary || 'Start writing…'}
              </span>
            )}
          </div>

          {body && (
            <div className="ed-side">
              <div className="found">
                <div className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#F38020">
                    <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
                  </svg>
                  Nexday found
                </div>
                <span style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>
                  {body.actionItems.length} action items
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
                  They fit before the critique at 15:00.
                </span>
                <div className="col" style={{ marginTop: 8 }}>
                  {body.actionItems.map((a, i, arr) => (
                    <div
                      className={`ed-rl${i === 0 ? ' top' : ''}${i === arr.length - 1 ? ' last' : ''}`}
                      key={a.title}
                    >
                      <span className="cb18" />
                      <span style={{ flex: 1 }}>{a.title}</span>
                      <span className="m" style={a.hot ? { color: 'var(--acc-text)' } : undefined}>
                        {a.time}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>Not now</span>
                  <span style={{ flex: 1 }} />
                  <Button variant="dark">Add all to plan</Button>
                </div>
              </div>

              {linkedTitle && (
                <>
                  <div className="ed-rh" style={{ paddingTop: 30 }}>
                    Linked event
                  </div>
                  <div className="ed-rl top">
                    <span
                      style={{ width: 3, height: 22, borderRadius: 2, background: '#4A78D4' }}
                    />
                    <span>{linkedTitle}</span>
                    <span style={{ flex: 1 }} />
                    {linkedTime && <span className="m">{linkedTime}</span>}
                  </div>
                </>
              )}
              {body.actionItems.length > 0 && (
                <>
                  <div className="ed-rh">
                    Linked tasks
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--ink3)' }}>
                      {body.actionItems.length}
                    </span>
                  </div>
                  <div className="ed-rl top">
                    <span className="cb18" />
                    <span>{body.actionItems[0].title}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fmt-bar">
        <span className="tb" style={{ fontWeight: 500, color: 'var(--ink)' }}>
          B
        </span>
        <span className="tb" style={{ fontStyle: 'italic' }}>
          I
        </span>
        <span className="tb" style={{ textDecoration: 'underline' }}>
          U
        </span>
        <span className="tb-sep" />
        <span className="tb">
          <Icon name="list" strokeWidth={1.7} round />
        </span>
        <span className="tb">
          <Icon name="checkSquare" strokeWidth={1.7} round />
        </span>
        <span className="tb">
          <Icon name="linkChain" strokeWidth={1.7} round />
        </span>
        <span className="tb-sep" />
        <span style={{ fontSize: 12.5, color: 'var(--ink3)', padding: '0 6px 0 4px' }}>Type</span>
        <Kbd mono>/</Kbd>
        <span style={{ fontSize: 12.5, color: 'var(--ink3)', paddingRight: 4 }}>for commands</span>
      </div>
    </main>
  )
}
