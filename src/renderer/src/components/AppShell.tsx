import { GO_TO, SHORTCUTS, comboOf, resolveShortcuts } from '../lib/shortcuts'
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
} from './Dialogs'
import { TaskDrawerHost } from './TaskDrawerHost'
import { Sidebar } from './Sidebar'
import { useUI } from '../store/ui'
import { useCalendar } from '../store/calendar'
import { startNotifier } from '../lib/notifier'

export function AppShell(): React.JSX.Element {
  const navigate = useNavigate()
  const { dialog, palette, newType, panel, openPalette, closePalette, openNew, openPanel } = useUI()

  // Read the Mac calendar on launch and again whenever the window comes back to the front.
  useEffect(() => {
    // First launch: ask once for Mac Calendar access so the person's real events show up on their own.
    void useCalendar
      .getState()
      .refresh()
      .then(async () => {
        const cal = useCalendar.getState()
        let asked = false
        try {
          asked = localStorage.getItem('nexday.calAsked') === '1'
        } catch {
          asked = true
        }
        if (cal.status === 'notDetermined' && !asked) {
          try {
            localStorage.setItem('nexday.calAsked', '1')
          } catch {
            /* ignore */
          }
          await cal.connect()
        }
      })
    // Events made in Mac Calendar show up without a restart: refresh on return, on becoming visible and every minute.
    const onFocus = (): void => void useCalendar.getState().refresh()
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && useCalendar.getState().status === 'authorized') onFocus()
    }, 60000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [])

  // Desktop notifications follow Settings › Notifications.
  useEffect(() => startNotifier(), [])

  // Global shortcuts (Settings › Shortcuts) and "G then a letter" to jump to a page.
  useEffect(() => {
    let goUntil = 0
    const typing = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const onKey = (e: KeyboardEvent): void => {
      const ui = useUI.getState()
      const combo = comboOf(e)
      if (combo) {
        const map = resolveShortcuts(ui.prefs)
        const hit = SHORTCUTS.find((s) => map[s.id] === combo)
        if (!hit) return
        e.preventDefault()
        if (hit.id === 'palette') {
          if (ui.palette) closePalette()
          else openPalette()
        } else if (hit.id === 'settings') navigate('/settings/profile')
        else if (hit.id === 'shortcuts') navigate('/settings/shortcuts')
        else if (hit.id === 'newProject') openPanel('newProject')
        else openNew(hit.id === 'newTask' ? 'task' : hit.id === 'newEvent' ? 'event' : 'note')
        return
      }
      if (!ui.prefs.singleKey || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      const k = e.key.toUpperCase()
      if (Date.now() < goUntil) {
        goUntil = 0
        const to = GO_TO.find((g) => g.key === k)
        if (to) {
          e.preventDefault()
          navigate(to.path)
        }
      } else if (k === 'G' && !e.shiftKey) goUntil = Date.now() + 1200
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
        <TaskDrawerHost />
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
    </>
  )
}
