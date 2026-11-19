import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHead, Topbar } from '../../components/page'
import { HABIT_SUGGESTIONS } from '../../components/GhostInput'
import { QuickCapture } from '../../components/QuickCapture'
import { Button, Segmented, cn } from '../../components/ui'
import type { Habit, HabitGroup } from '../../data/habits'
import { useHabits } from '../../store/habits'
import { addDays, appToday, dayKey, pageDate, startOfWeek, weekdayIndex } from '../../lib/clock'
import { habitNumbers, habitStats, milestone, type History, type HabitStats } from '../../lib/habitStats'
import { supabase } from '../../lib/supabase'
import HabitDrawer from './HabitDrawer'
import HabitsEmpty from './HabitsEmpty'
import './habits.css'

type Filter = 'all' | HabitGroup

const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function WeekCells({
  habit,
  history,
  onToggle
}: {
  habit: Habit
  history: History
  onToggle: () => void
}): React.JSX.Element {
  const now = appToday()
  const todayIdx = weekdayIndex(now)
  const monday = startOfWeek(now)
  return (
    <div className="hb-week">
      {Array.from({ length: 7 }, (_, i) => {
        if (i < todayIdx) {
          const on = history[habit.id]?.includes(dayKey(addDays(monday, i)))
          return on ? (
            <i className="hb-w y" key={i} style={{ display: 'flex' }}>
              <Icon name="check" size={10} strokeWidth={3.5} />
            </i>
          ) : (
            <i className="hb-w f" key={i} style={{ display: 'flex' }} />
          )
        }
        if (i > todayIdx) return <i className="hb-w f" key={i} style={{ display: 'flex' }} />
        return habit.doneToday ? (
          <button
            key={i}
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
            key={i}
            className="hb-w t"
            aria-label="Mark done"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          />
        )
      })}
    </div>
  )
}

export default function Habits(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { habits: stored, toggleToday, skipToday, skipped, history } = useHabits()
  const now = appToday()
  // With an account, streak / rate / check-ins come from the real check-ins, not the saved snapshot.
  const habits = stored.map((h) => (supabase ? { ...h, ...habitNumbers(h, history, now) } : h))
  const stats = habitStats(habits, history, now)
  const best = milestone(habits, history, now)
  const [filter, setFilter] = useState<Filter>('all')

  if (id === 'empty' || stored.length === 0) return <HabitsEmpty />

  const total = habits.length
  const done = habits.filter((h) => h.doneToday).length
  const visible = filter === 'all' ? habits : habits.filter((h) => h.group === filter)
  const next = habits.find((h) => !h.doneToday && !skipped.includes(h.id))
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
            ['Active streak', `${stats.activeStreak} ${stats.activeStreak === 1 ? 'day' : 'days'}`],
            ['This week', stats.weekRate === null ? '—' : `${stats.weekRate}%`],
            ['This month', stats.monthRate === null ? '—' : `${stats.monthRate}%`]
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
                  <span className={cn('hb-dl', i === weekdayIndex(now) && 'today')} key={i}>
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
                <WeekCells habit={h} history={history} onToggle={() => toggleToday(h.id)} />
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

            <Consistency stats={stats} />
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
                    <button className="row" style={{ height: 36, padding: '0 4px' }} onClick={() => skipToday(next.id)}>
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
                    Nothing else is planned until tomorrow.
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
                  {!h.doneToday && skipped.includes(h.id) && (
                    <span className="muted" style={{ fontSize: 12 }}>
                      skipped
                    </span>
                  )}
                  <button
                    aria-label={h.doneToday ? 'Undo today' : 'Mark done'}
                    style={{ display: 'flex', color: '#fff' }}
                    onClick={() => toggleToday(h.id)}
                  >
                    {h.doneToday ? (
                      <i className="hb-w y sm" style={{ display: 'flex' }}>
                        <Icon name="check" size={9} strokeWidth={3.5} />
                      </i>
                    ) : (
                      <i className="hb-w t sm" style={{ display: 'flex' }} />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {best && best.streak > 0 && (
              <div className="col">
                <div className="side-head">
                  <h2>Longest streak</h2>
                </div>
                <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>
                    {best.days} / 14 days
                  </span>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {best.name}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', marginTop: 10 }}>
                  <div
                    style={{
                      width: `${Math.round((best.days / 14) * 100)}%`,
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--acc)'
                    }}
                  />
                </div>
                <span className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                  {best.streak}-day streak running.
                </span>
              </div>
            )}
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

function Consistency({ stats }: { stats: HabitStats }): React.JSX.Element {
  const facts: Array<[string, string]> = [
    ['Check-ins', String(stats.checkIns)],
    ['Longest streak', stats.longest ? `${stats.longest.days} ${stats.longest.days === 1 ? 'day' : 'days'} · ${stats.longest.name}` : '—'],
    ['Strongest weekday', stats.strongest ?? '—'],
    ['Weakest weekday', stats.weakest ?? '—']
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
            {stats.months.map((m, i) => (
              <span
                className="muted"
                key={i}
                style={{ fontSize: 11, width: 27, flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {m}
              </span>
            ))}
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
              {stats.heatmap.flatMap((week, wi) =>
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
