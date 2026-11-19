import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { NOTE_SUGGESTIONS } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { Button } from '../../components/ui'
import { useNotes } from '../../store/notes'
import { useUI } from '../../store/ui'
import { pageDate } from '../../lib/clock'
import './notes.css'

/** Notes with nothing in it yet. */
export default function NotesEmpty(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <main className="panel">
      <Topbar icon="notes" section="Notes" current="All notes" />
      <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <PageHead date={pageDate()} title="Notes" sub="0 notes yet." />
        <div className="notes-empty">
          <span style={{ color: '#BDBDBA', display: 'flex' }}>
            <Icon name="noteLines" size={44} strokeWidth={1.4} round />
          </span>
          <h2>No notes yet</h2>
          <p>
            Write your first note. Nexday links it to events on your calendar and pulls out the
            tasks hiding inside.
          </p>
          <div className="row" style={{ gap: 12, marginTop: 14 }}>
            <Button>Browse templates</Button>
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
              New note
            </Button>
          </div>
        </div>
      </div>
      <QuickCapture
        suggestions={NOTE_SUGGESTIONS}
        placeholder={'Write a note… "meeting with Ece, link to Design critique"'}
        button="Save"
        hint="Notes link to events on their own, and Nexday pulls out the tasks hiding inside."
      />
    </main>
  )
}
