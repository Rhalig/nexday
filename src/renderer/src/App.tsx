import { useEffect } from 'react'
import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom'
import { AppShell } from './components/AppShell'
import Tasks from './pages/tasks/Tasks'
import Calendar from './pages/calendar/Calendar'
import CalendarEmpty from './pages/calendar/CalendarEmpty'
import Habits from './pages/habits/Habits'
import Inbox from './pages/inbox/Inbox'
import Notes from './pages/notes/Notes'
import NoteEditor from './pages/notes/NoteEditor'
import NotesEmpty from './pages/notes/NotesEmpty'
import Project from './pages/projects/Project'
import Today from './pages/today/Today'
import Settings from './pages/settings/Settings'
import { CheckEmail, Forgot, Launch, Login, Register, ResetPassword } from './pages/entry/Entry'
import Onboarding from './pages/entry/Onboarding'
import Focus from './pages/focus/Focus'
import { TasksEmpty, TasksLoading, TasksSyncError } from './pages/tasks/TasksStates'
import { useAuth } from './store/auth'
import { useCalendar } from './store/calendar'
import { retryLoad, useSync } from './lib/cloud'
import { supabase } from './lib/supabase'
import { useUI } from './store/ui'

function Placeholder({ name }: { name: string }): React.JSX.Element {
  return (
    <main className="panel">
      <span className="muted">{name} — not built yet</span>
    </main>
  )
}

/** The page the person chose to open first (Settings › Preferences). */
function StartPage(): React.JSX.Element {
  const start = useUI((s) => s.prefs.startPage)
  return <Navigate to={start === 'Calendar' ? '/calendar' : start === 'Inbox' ? '/inbox' : '/today'} replace />
}

function CalendarEmptyRoute(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <CalendarEmpty
      onConnect={() => {
        void useCalendar.getState().connect()
        navigate('/calendar')
      }}
    />
  )
}

function RequireAuth(): React.JSX.Element {
  const signedIn = useAuth((s) => s.signedIn)
  const ready = useAuth((s) => s.ready)
  const dataReady = useSync((s) => s.ready)
  const loadError = useSync((s) => s.loadError)
  const userId = useAuth((s) => s.userId)
  if (!ready) return <></>
  if (!signedIn) return <Navigate to="/launch" replace />
  // With an account, show the app once that person's data has arrived
  if (supabase && !dataReady) {
    if (!loadError) return <div className="drag-strip" />
    return (
      <>
        <div className="drag-strip" />
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <div className="col" style={{ maxWidth: 380, textAlign: 'center', gap: 10, alignItems: 'center' }}>
            <h2 style={{ fontWeight: 500, fontSize: 20 }}>We couldn’t load your data</h2>
            <p className="muted" style={{ lineHeight: 1.5 }}>
              Nothing has been changed or lost. Check your connection and try again.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={() => void useAuth.getState().signOut()}>
                Sign out
              </button>
              <button className="btn dark" onClick={() => userId && retryLoad(userId)}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }
  return <Outlet />
}

/** A reset link signs the person in, but they must choose a new password before the app opens. */
function RecoveryGate(): null {
  const recovery = useAuth((s) => s.recovery)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (recovery && pathname !== '/reset') navigate('/reset', { replace: true })
  }, [recovery, pathname, navigate])
  return null
}

function CheckEmailRoute(): React.JSX.Element {
  const { state } = useLocation()
  const s = state as { email?: string; kind?: 'reset' | 'confirm' } | null
  return <CheckEmail email={s?.email || 'your inbox'} kind={s?.kind} />
}

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <RecoveryGate />
      <Routes>
        <Route path="/launch" element={<Launch />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/forgot/sent" element={<CheckEmailRoute />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/onboarding/:step" element={<Onboarding />} />
        <Route element={<RequireAuth />}>
          <Route path="/settings/:tab?" element={<Settings />} />
          <Route path="/focus" element={<Focus />} />
          <Route element={<AppShell />}>
            <Route index element={<StartPage />} />
            <Route path="/today" element={<Today />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/calendar/empty" element={<CalendarEmptyRoute />} />
            <Route path="/habits/:id?" element={<Habits />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notes/empty" element={<NotesEmpty />} />
            <Route path="/notes/:id" element={<NoteEditor />} />
            <Route path="/projects/:slug" element={<Project />} />
            <Route path="/tasks/empty" element={<TasksEmpty />} />
            <Route path="/tasks/error" element={<TasksSyncError />} />
            <Route path="/tasks/loading" element={<TasksLoading />} />
            <Route path="/tasks/:id?" element={<Tasks />} />
            <Route path="*" element={<Placeholder name="This page" />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  )
}
