import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { HABIT_SUGGESTIONS } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { Button } from '../../components/ui'
import { habitSuggestions } from '../../data/habits'
import { pageDate } from '../../lib/clock'
import './habits.css'

/** Habits before the first one exists. */
export default function HabitsEmpty(): React.JSX.Element {
  return (
    <main className="panel">
      <Topbar icon="habits" section="Habits" current="All habits" />
      <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <PageHead
          date={pageDate()}
          title="Habits"
          sub="No habits yet. Start with one small thing."
        />
        <div className="habits-empty">
          <span style={{ color: '#BDBDBA', display: 'flex' }}>
            <Icon name="habits" size={44} strokeWidth={1.4} round />
          </span>
          <h2>Build your first habit</h2>
          <p>
            Pick something small and Nexday finds a slot for it every day, then keeps that slot
            clear on your calendar.
          </p>
          <div className="col" style={{ marginTop: 18, borderTop: '1px solid var(--line)' }}>
            {habitSuggestions.map((s) => (
              <button className="hb-sg" key={s.name}>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14 }}>{s.name}</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{s.hint}</span>
              </button>
            ))}
          </div>
          <Button variant="dark" style={{ marginTop: 18 }}>
            New habit
          </Button>
        </div>
      </div>
      <QuickCapture
        suggestions={HABIT_SUGGESTIONS}
        placeholder={'Add a habit… "drink water every 2 hours from 09:00"'}
        button="Add"
        hint="Nexday finds a slot for every habit and keeps it clear on your calendar."
      />
    </main>
  )
}
