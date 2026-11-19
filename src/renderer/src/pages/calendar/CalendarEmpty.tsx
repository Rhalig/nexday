import { Icon } from '../../components/Icon'
import { Button } from '../../components/ui'
import { addDays, appToday, monthShort, sameDay, startOfWeek, weekdayShort } from '../../lib/clock'
import './calendar.css'

const hours = Array.from({ length: 12 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`)

/** Calendar with nothing connected / no events. */
export default function CalendarEmpty({ onConnect }: { onConnect: () => void }): React.JSX.Element {
  const start = startOfWeek(appToday())
  const end = addDays(start, 6)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i)
    return { wd: weekdayShort(d), n: String(d.getDate()), today: sameDay(d, appToday()) }
  })
  return (
    <main className="panel">
      <div className="topbar" style={{ height: 36 }}>
        <div className="crumbs" style={{ gap: 8 }}>
          <Icon name="calendar" size={15} />
          <span>Calendar</span>
          <span style={{ color: '#BDBDBA' }}>/</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>Week</span>
        </div>
        <Button variant="dark">+ New</Button>
      </div>

      <div className="cal-empty-head">
        <div className="col" style={{ gap: 6, flex: 1 }}>
          <span className="muted">
            {monthShort(start)} {start.getDate()} – {monthShort(end)} {end.getDate()},{' '}
            {end.getFullYear()}
          </span>
          <span style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.15 }}>This week</span>
        </div>
        <Button>Today</Button>
        <Button>‹</Button>
        <Button>›</Button>
      </div>

      <div className="row" style={{ marginTop: 22, paddingLeft: 44 }}>
        {days.map((d) => (
          <div className="ce-dh" key={d.n}>
            <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{d.wd}</span>{' '}
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                marginLeft: 4,
                color: d.today ? 'var(--acc-text)' : undefined
              }}
            >
              {d.n}
            </span>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', flex: 1, borderTop: '1px solid var(--line)' }}>
        <div style={{ paddingLeft: 44, position: 'relative' }}>
          {hours.map((h) => (
            <div className="ce-hr" key={h}>
              <span>{h}</span>
            </div>
          ))}
        </div>
        <div className="ce-overlay">
          <span style={{ color: '#BDBDBA', display: 'flex' }}>
            <Icon name="calendarLg" size={44} strokeWidth={1.4} round />
          </span>
          <h2>Your week is open</h2>
          <p>
            Connect a calendar to see your meetings here, or add a task and Nexday will find a time
            for it.
          </p>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <Button onClick={onConnect}>Connect calendar</Button>
            <Button variant="dark">New task</Button>
          </div>
        </div>
      </div>
    </main>
  )
}
