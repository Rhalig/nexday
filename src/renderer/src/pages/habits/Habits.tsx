import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { HABIT_SUGGESTIONS } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { Button, Segmented, cn } from '../../components/ui'
import { heatmap, type Habit, type HabitGroup } from '../../data/habits'
import { useHabits } from '../../store/habits'
import { pageDate } from '../../lib/clock'
import HabitDrawer from './HabitDrawer'
import HabitsEmpty from './HabitsEmpty'
import './habits.css'

type Filter = 'all' | HabitGroup

const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function WeekCells({ habit, onToggle }: { habit: Habit; onToggle: () => void }): React.JSX.Element {
  return (
    <div className="hb-week">
      <i className="hb-w y" style={{ display: 'flex' }}>
        <Icon name="check" size={10} strokeWidth={3.5} />
      </i>
      {habit.doneToday ? (
        <button
          className="hb-w y"
          aria-label="Undo today"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          <Icon name="check" size={10} strokeWidth={3.5} />
        </button>
      ) : (
        <button
          className="hb-w t"
          aria-label="Mark done"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        />
      )}
      {[0, 1, 2, 3, 4].map((i) => (
        <i className="hb-w f" key={i} style={{ display: 'flex' }} />
      ))}
    </div>
  )
}

export default function Habits(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { habits, toggleToday } = useHabits()
  const [filter, setFilter] = useState<Filter>('all')

  if (id === 'empty') return <HabitsEmpty />

  const total = habits.length
  const done = habits.filter((h) => h.doneToday).length
  const visible = filter === 'all' ? habits : habits.filter((h) => h.group === filter)
  const next = habits.find((h) => !h.doneToday)
  const open = id ? habits.find((h) => h.id === id) : undefined

  const tabs = [
    { id: 'all' as Filter, label: 'All', count: total },
    {
      id: 'morning' as Filter,
      label: 'Morning',
      count: habits.filter((h) => h.group === 'morning').length
    },
    {
      id: 'evening' as Filter,
      label: 'Evening',
      count: habits.filter((h) => h.group === 'evening').length
    }
  ]

  return (
    <main className="panel">
      <Topbar icon="habits" section="Habits" current="All habits" />

      <div className="panel-scroll">
        <PageHead
          date={pageDate()}
          title="Habits"
          sub={`${done} of ${total} done today. ${
            done < total
              ? `The other ${total - done} are on your calendar tonight.`
              : 'Nothing left for today.'
          }`}
          stats={[
            ['Done today', `${done}/${total}`],
            ['Active streak', '12 days'],
            ['This week', '78%'],
            ['This month', '74%']
          ]}
        />

        <div className="habits-toolbar">
          <Segmented items={tabs} value={filter} onChange={setFilter} />
          <span className="muted" style={{ fontSize: 12.5 }}>
            Sorted by time of day
          </span>
        </div>

        <div className="habits-body">
          <section className="habits-main">
            <div className="hb-head">
              <span className="label" style={{ flex: 1 }}>
                Habit
              </span>
              <div className="hb-days">
                {dayLabels.map((d, i) => (
                  <span className={cn('hb-dl', i === 1 && 'today')} key={i}>
                    {d}
                  </span>
                ))}
              </div>
              <span className="label" style={{ width: 112, flexShrink: 0 }}>
                30-day rate
              </span>
              <span className="label" style={{ width: 64, textAlign: 'right' }}>
                Streak
              </span>
            </div>

            {visible.map((h, i) => (
              <div
                className={cn('hb-row', i === 0 && 'first', i === visible.length - 1 && 'last')}
                key={h.id}
                onClick={() => navigate(`/habits/${h.id}`)}
              >
                <div className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span className="hb-name">{h.name}</span>
                  <span className="hb-sub">{h.sub}</span>
                </div>
                <WeekCells habit={h} onToggle={() => toggleToday(h.id)} />
                <div className="hb-rate">
                  <div className="hb-bar">
                    <div style={{ width: `${h.rate}%` }} />
                  </div>
                  <span
                    className="mono muted"
                    style={{ fontSize: 12.5, width: 30, textAlign: 'right' }}
                  >
                    {h.rate}%
                  </span>
                </div>
                <span className="hb-streak">{h.streak} days</span>
              </div>
            ))}

            <Consistency />
          </section>

          <aside className="habits-side">
            <div className="hb-card">
              {next ? (
                <>
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
                      Up next · {next.upNextIn}
                    </span>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 500, marginTop: 10 }}>{next.name}</span>
                  <span className="mono muted" style={{ fontSize: 12.5 }}>
                    {next.time}–{next.slotEnd}
                    {next.upNextNote ? ` · ${next.upNextNote}` : ''}
                  </span>
                  <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
                    <button className="row" style={{ height: 36, padding: '0 4px' }}>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Skip today
                      </span>
                    </button>
                    <Button variant="dark" onClick={() => toggleToday(next.id)}>
                      <span>Mark done</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Up next
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 500, marginTop: 10 }}>
                    All done for today
                  </span>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    Your next slot is tomorrow at 07:00.
                  </span>
                </>
              )}
            </div>

            <div className="col">
              <div className="side-head" style={{ marginBottom: 6 }}>
                <h2>Today&apos;s slots</h2>
                <a href="#/calendar" className="muted" style={{ fontSize: 12.5 }}>
                  Open calendar
                </a>
              </div>
              {habits.map((h, i) => (
                <div className={cn('hb-slot', i === habits.length - 1 && 'last')} key={h.id}>
                  <span className="mono muted" style={{ fontSize: 12.5, width: 42 }}>
                    {h.time}
                  </span>
                  <span style={{ flex: 1, fontSize: 13.5 }}>{h.name}</span>
                  {h.doneToday ? (
                    <i className="hb-w y sm" style={{ display: 'flex' }}>
                      <Icon name="check" size={9} strokeWidth={3.5} />
                    </i>
                  ) : (
                    <i className="hb-w t sm" style={{ display: 'flex' }} />
                  )}
                </div>
              ))}
            </div>

            <div className="col">
              <div className="side-head">
                <h2>Next milestone</h2>
              </div>
              <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                <span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>
                  12 / 14 days
                </span>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  Morning run
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', marginTop: 10 }}>
                <div
                  style={{ width: '86%', height: 4, borderRadius: 2, background: 'var(--acc)' }}
                />
              </div>
              <span className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                Two more mornings and you reach a 2-week streak.
              </span>
            </div>

            <div className="col">
              <div className="side-head">
                <h2>Nexday noticed</h2>
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#2A2A2A' }}>
                You skip Read 20 pages on days with evening meetings. Moving it to 20:00 would save
                4 of the last 5 misses.
              </p>
              <div className="row" style={{ marginTop: 12, gap: 10 }}>
                <Button variant="dark">
                  <span style={{ fontSize: 13 }}>Move to 20:00</span>
                </Button>
                <button className="row" style={{ height: 36, padding: '0 8px' }}>
                  <span className="muted" style={{ fontSize: 13 }}>
                    Keep 20:30
                  </span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <QuickCapture
        suggestions={HABIT_SUGGESTIONS}
        onSubmit={(text) => useHabits.getState().add(text)}
        placeholder={'Add a habit… "drink water every 2 hours from 09:00"'}
        button="Add"
        hint="Nexday finds a slot for every habit and keeps it clear on your calendar."
      />

      {open && <HabitDrawer habit={open} onClose={() => navigate('/habits')} />}
    </main>
  )
}

function Consistency(): React.JSX.Element {
  const facts: Array<[string, string]> = [
    ['Check-ins', '312'],
    ['Longest streak', '21 days · Morning run'],
    ['Strongest weekday', 'Wednesday'],
    ['Weakest weekday', 'Sunday']
  ]
  return (
    <div className="hb-cons">
      <div className="row" style={{ gap: 14, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 500 }}>Consistency</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Last 12 weeks · all habits combined
        </span>
      </div>
      <div className="row" style={{ alignItems: 'flex-start', gap: 56 }}>
        <div className="col" style={{ gap: 8 }}>
          <div className="row" style={{ paddingLeft: 36 }}>
            <span className="muted" style={{ fontSize: 11, width: 27, marginLeft: 27 }}>
              Sep
            </span>
            <span className="muted" style={{ fontSize: 11, width: 27, marginLeft: 81 }}>
              Oct
            </span>
            <span className="muted" style={{ fontSize: 11, width: 27, marginLeft: 81 }}>
              Nov
            </span>
          </div>
          <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <div className="col" style={{ gap: 5, width: 26 }}>
              {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
                <span
                  className="muted"
                  key={i}
                  style={{ fontSize: 10.5, height: 22, lineHeight: '22px' }}
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="hb-hm">
              {heatmap.flatMap((week, wi) =>
                week.map((lvl, di) => (
                  <i key={`${wi}-${di}`} className={lvl ? `l${lvl}` : undefined} />
                ))
              )}
            </div>
          </div>
          <div className="row hb-lg" style={{ gap: 6, paddingLeft: 36, marginTop: 2 }}>
            <span className="muted" style={{ fontSize: 11 }}>
              Less
            </span>
            <i />
            <i className="l1" />
            <i className="l2" />
            <i className="l3" />
            <span className="muted" style={{ fontSize: 11 }}>
              More
            </span>
          </div>
        </div>
        <div className="col" style={{ flex: 1 }}>
          {facts.map(([k, v]) => (
            <div className="hb-fact" key={k}>
              <span className="muted" style={{ fontSize: 13 }}>
                {k}
              </span>
              <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
