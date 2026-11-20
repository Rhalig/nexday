import { Drawer } from '../../components/Drawer'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/ui'
import type { Habit } from '../../data/habits'
import { useHabits } from '../../store/habits'
import { appToday, monthLong } from '../../lib/clock'
import './habits.css'

type Cell = { n: number; kind: 'y' | 'm' | 'f' | 't' }

/** This month's check-ins, Monday first. Past days keep the design's sample pattern. */
function monthCells(today: Date, doneToday: boolean): { lead: number; cells: Cell[] } {
  const missed = new Set([2, 5])
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const lead = (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7
  const cells: Cell[] = []
  for (let n = 1; n <= days; n++) {
    let kind: Cell['kind']
    if (n > today.getDate()) kind = 'f'
    else if (n === today.getDate()) kind = doneToday ? 'y' : 't'
    else kind = missed.has(n) ? 'm' : 'y'
    cells.push({ n, kind })
  }
  return { lead, cells }
}

export default function HabitDrawer({
  habit,
  onClose
}: {
  habit: Habit
  onClose: () => void
}): React.JSX.Element {
  const toggleToday = useHabits((s) => s.toggleToday)
  const skipToday = useHabits((s) => s.skipToday)
  const setPaused = useHabits((s) => s.setPaused)
  const skipped = useHabits((s) => s.skipped.includes(habit.id))
  const today = appToday()
  const month = monthCells(today, habit.doneToday)
  const cadence = habit.sub.split(' · ')[0]

  return (
    <Drawer onClose={onClose}>
      <div className="row" style={{ height: 34, gap: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--acc)' }} />
        <span style={{ fontSize: 13, color: 'var(--ink3)', marginLeft: 2 }}>Habits</span>
        <span style={{ color: '#BDBDBA' }}>/</span>
        <span style={{ fontSize: 13 }}>{habit.group === 'morning' ? 'Morning' : 'Evening'}</span>
        <span style={{ flex: 1 }} />
        <span className="hd-ic">
          <Icon name="expand" strokeWidth={1.7} round />
        </span>
        <span className="hd-ic">
          <Icon name="more" strokeWidth={1.7} round />
        </span>
        <button className="hd-ic" aria-label="Close" onClick={onClose}>
          <Icon name="x" strokeWidth={1.7} round />
        </button>
      </div>

      <div className="col" style={{ marginTop: 22, gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.25 }}>{habit.name}</span>
        <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>
          {cadence} ·{' '}
          <span className="hd-mono">
            {habit.time} – {habit.slotEnd}
          </span>
        </span>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 14 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="#F38020">
          <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
        </svg>
        <span style={{ fontSize: 13, color: 'var(--ink2)' }}>
          {habit.id === 'run'
            ? 'The slot is reserved on your calendar. You finish most runs when it stays at 07:00.'
            : 'The slot is reserved on your calendar.'}
        </span>
      </div>

      <div
        className="row"
        style={{
          marginTop: 28,
          padding: '18px 0',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)'
        }}
      >
        <div className="hd-stat">
          <span>Streak</span>
          <span>{habit.streak} days</span>
        </div>
        <div className="hd-stat">
          <span>30-day rate</span>
          <span>{habit.rate}%</span>
        </div>
        <div className="hd-stat">
          <span>Check-ins</span>
          <span>{habit.checkIns}</span>
        </div>
      </div>

      <div className="hd-h">
        {monthLong(today)} {today.getFullYear()}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>Previous · Next</span>
      </div>
      <div className="hd-gr">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span className="d" key={i}>
            {d}
          </span>
        ))}
        {Array.from({ length: month.lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {month.cells.map((c) => (
          <span
            className={`hd-c ${c.kind}`}
            key={c.n}
            style={
              c.kind === 't' ? { border: '1.5px solid var(--acc)', color: 'var(--ink)' } : undefined
            }
          >
            {c.kind === 'y' ? <Icon name="check" size={12} strokeWidth={3.2} round /> : c.n}
          </span>
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <div className="row" style={{ gap: 10, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <Button onClick={() => setPaused(habit.id, !habit.paused)}>{habit.paused ? 'Resume habit' : 'Pause habit'}</Button>
        <span style={{ flex: 1 }} />
        <Button
          disabled={habit.doneToday || habit.paused}
          onClick={() => {
            skipToday(habit.id)
            onClose()
          }}
        >
          {skipped ? 'Skipped today' : 'Skip today'}
        </Button>
        <Button variant="dark" onClick={() => toggleToday(habit.id)}>
          Mark done
          <span className="kbd dark-kbd">⌘ D</span>
        </Button>
      </div>
    </Drawer>
  )
}
