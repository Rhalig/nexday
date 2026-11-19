import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'
import { NewPopup } from './NewPopup'
import { HelpModal, NewProjectPopup, NotificationPanel, ProfileMenu } from './Popups'
import {
  AutoScheduleDialog,
  InboxRulesDialog,
  ProjectSettingsDialog,
  ShareDialog,
  TemplatesDialog,
  UpgradeDialog
} from './Dialogs'
import { Sidebar } from './Sidebar'
import { useUI } from '../store/ui'
import { useCalendar } from '../store/calendar'

export function AppShell(): React.JSX.Element {
  const navigate = useNavigate()
  const { dialog, palette, newType, panel, openPalette, closePalette, openNew, openPanel } = useUI()

  // Read the Mac calendar on launch and again whenever the window comes back to the front.
  useEffect(() => {
    void useCalendar.getState().refresh()
    const onFocus = (): void => void useCalendar.getState().refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Global shortcuts: ⌘K palette, ⌘T / ⌘E / ⌘N create
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.metaKey && !e.ctrlKey) return
      const k = e.key.toLowerCase()
      if (k === 'k') {
        e.preventDefault()
        if (useUI.getState().palette) closePalette()
        else openPalette()
      } else if (k === ',') {
        e.preventDefault()
        navigate('/settings/profile')
      } else if (k === '/') {
        e.preventDefault()
        navigate('/settings/shortcuts')
      } else if (e.shiftKey && k === 'p') {
        e.preventDefault()
        openPanel('newProject')
      } else if (!e.shiftKey && (k === 't' || k === 'e' || k === 'n')) {
        e.preventDefault()
        openNew(k === 't' ? 'task' : k === 'e' ? 'event' : 'note')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPalette, closePalette, openNew, openPanel, navigate])

  return (
    <>
      <div className="drag-strip" />
      <div className="app">
        <Sidebar />
        <Outlet />
      </div>
      {palette && <CommandPalette />}
      {newType && <NewPopup type={newType} />}
      {panel === 'profile' && <ProfileMenu />}
      {panel === 'notifs' && <NotificationPanel />}
      {panel === 'help' && <HelpModal />}
      {panel === 'newProject' && <NewProjectPopup />}
      {dialog?.name === 'autoSchedule' && <AutoScheduleDialog />}
      {dialog?.name === 'inboxRules' && <InboxRulesDialog />}
      {dialog?.name === 'templates' && <TemplatesDialog />}
      {dialog?.name === 'projectSettings' && <ProjectSettingsDialog slug={dialog.slug ?? ''} />}
      {dialog?.name === 'share' && <ShareDialog slug={dialog.slug ?? ''} />}
      {dialog?.name === 'upgrade' && <UpgradeDialog resource={dialog.slug} />}
    </>
  )
}
