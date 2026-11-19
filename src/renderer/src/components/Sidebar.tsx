import { NavLink } from 'react-router-dom'
import logo from '../assets/logo.jpg'
import { Icon, type IconName } from './Icon'
import { useInbox } from '../store/inbox'
import { countOpen, useTasks } from '../store/tasks'
import { unreadCount, useNotifs } from '../store/notifs'
import { useProjects } from '../store/projects'
import { useUI } from '../store/ui'
import { Kbd, cn } from './ui'

const nav: Array<{ to: string; label: string; icon: IconName; count?: number }> = [
  { to: '/today', label: 'Today', icon: 'sun' },
  { to: '/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/notes', label: 'Notes', icon: 'notes', count: 14 },
  { to: '/habits', label: 'Habits', icon: 'habits' }
]

const projectNav = [
  { to: '/projects/planner-mvp', label: 'Planner MVP', color: 'var(--acc)', count: 7 },
  { to: '/projects/moving-house', label: 'Moving house', color: 'var(--work)', count: 2 },
  { to: '/projects/reading-list', label: 'Reading list', color: 'var(--personal)', count: 2 }
]

const linkClass = ({ isActive }: { isActive: boolean }): string => cn('nav-item', isActive && 'on')

export function Sidebar(): React.JSX.Element {
  const inboxCount = useInbox((s) => s.items.length)
  const openPalette = useUI((s) => s.openPalette)
  const panel = useUI((s) => s.panel)
  const openPanel = useUI((s) => s.openPanel)
  const unread = useNotifs((s) => unreadCount(s.items))
  const custom = useProjects((s) => s.custom)
  const tasksCount = useTasks((s) => countOpen(s.groups))
  const groups = useTasks((s) => s.groups)
  const openBy = (project: string): number => groups.reduce((n, g) => n + g.tasks.filter((t) => t.project === project).length, 0)
  const projectCounts: Record<string, number> = {
    '/projects/planner-mvp': openBy('planner'),
    '/projects/moving-house': openBy('moving'),
    '/projects/reading-list': openBy('reading')
  }
  return (
    <aside className="sidebar">
      <div className="sidebar-drag" />
      {/* Room for the native macOS traffic lights (hiddenInset, see main/index.ts) */}
      <div className="traffic-spacer" />
      <div className="brand">
        <div className="brand-logo" style={{ backgroundImage: `url(${logo})` }} />
        <span className="brand-name">Nexday</span>
        <span style={{ flex: 1 }} />
        <button className={cn('bell', panel === 'notifs' && 'on')} aria-label="Notifications" onClick={() => openPanel('notifs')}>
          <Icon name="bell" size={17} round />
          {unread > 0 && <span className="bell-dot" />}
        </button>
      </div>

      <button className="search-btn" onClick={openPalette}>
        <Icon name="search" size={15} strokeWidth={2} />
        <span style={{ flex: 1 }}>Search or command</span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav className="nav-group">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} className={linkClass}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
            {(n.to === '/inbox' ? inboxCount : n.to === '/tasks' ? tasksCount : n.count) ? (
              <span className="count">{n.to === '/inbox' ? inboxCount : n.to === '/tasks' ? tasksCount : n.count}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <span className="label nav-label">Projects</span>
      <nav className="nav-group">
        {projectNav.map((p) => (
          <NavLink key={p.to} to={p.to} className={linkClass}>
            <div className="swatch" style={{ background: p.color }} />
            <span>{p.label}</span>
            <span className="count">{projectCounts[p.to] ?? p.count}</span>
          </NavLink>
        ))}
        {custom.map((c) => (
          <NavLink key={c.slug} to={`/projects/${c.slug}`} className={linkClass}>
            <div className="swatch" style={{ background: c.color }} />
            <span>{c.name}</span>
          </NavLink>
        ))}
        <a className="nav-item muted-item" href="#/projects/new" onClick={(e) => { e.preventDefault(); openPanel('newProject') }}>
          <Icon name="plus" />
          <span>New project</span>
        </a>
      </nav>

      <div className="profile" onClick={() => openPanel('profile')}>
        <div className="avatar">U</div>
        <div className="col" style={{ lineHeight: 1.25 }}>
          <span style={{ fontWeight: 500 }}>Umut</span>
          <span className="muted" style={{ fontSize: 12 }}>
            Personal space
          </span>
        </div>
      </div>
    </aside>
  )
}
