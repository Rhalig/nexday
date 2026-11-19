import { useNavigate } from 'react-router-dom'
import { Drawer } from '../../components/Drawer'
import { DrawerHeader } from '../../components/DrawerParts'
import { Icon } from '../../components/Icon'
import { Button, cn } from '../../components/ui'
import { dotColor, fmtTime, type KindedEvent } from '../../data/calendar'
import { appToday, monthShort, parseDayKey, sameDay, weekdayShort } from '../../lib/clock'

const DESIGN_BLUE = '#4A78D4'

/** Richer detail exists only for the design critique, the event the design shows in full. */
const isCritique = (e: KindedEvent): boolean => e.title === 'Design critique'

export default function EventDrawer({
  event: e,
  onClose,
  repeatLabel = 'Does not repeat',
  onDelete
}: {
  event: KindedEvent
  onClose: () => void
  repeatLabel?: string
  onDelete?: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const color = e.kind === 'blue' ? DESIGN_BLUE : dotColor[e.kind]
  const range = e.allDay ? 'All day' : `${fmtTime(e.start)} – ${fmtTime(e.end)}`
  const date = parseDayKey(e.date)
  const today = sameDay(date, appToday())
  const critique = isCritique(e)
  const name = e.monthTitle ?? e.title.replace(/ · \d{2}:\d{2}$/, '')

  return (
    <Drawer onClose={onClose}>
      <DrawerHeader color={color} section="Calendar" name="Planner MVP" onClose={onClose} />

      <div className="dw-scroll">
        <div className="row" style={{ gap: 14, marginTop: 22, alignItems: 'flex-start' }}>
          <span
            style={{
              width: 4,
              height: 28,
              borderRadius: 2,
              background: color,
              marginTop: 2,
              flex: 'none'
            }}
          />
          <div className="col" style={{ gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.25 }}>{name}</span>
            <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>
              {today ? 'Today · ' : ''}
              {weekdayShort(date)}, {monthShort(date)} {date.getDate()} ·{' '}
              <span className="dw-mono">{range}</span>
            </span>
          </div>
        </div>

        {critique && (
          <>
            <div className="row" style={{ gap: 6, marginTop: 14, paddingLeft: 18 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#F38020">
                <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
              </svg>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>
                You are free from 13:00. Your prep task is planned at 14:30.
              </span>
            </div>
            <div className="row" style={{ gap: 12, marginTop: 20, paddingLeft: 18 }}>
              <Button variant="dark">
                <Icon name="video" size={15} strokeWidth={1.8} round />
                Join Google Meet
              </Button>
              <span style={{ fontSize: 13, color: 'var(--ink3)' }}>Starts in 4 h 20 min</span>
            </div>
          </>
        )}

        <div className="col" style={{ marginTop: 26 }}>
          <div className="dw-p">
            <span className="k">When</span>
            <span className="v">
              {today ? 'Today' : weekdayShort(date)}, <span className="dw-mono">{range}</span>
            </span>
          </div>
          <div className="dw-p">
            <span className="k">Calendar</span>
            <span className="v">
              <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
              Planner MVP
            </span>
          </div>
          {critique && (
            <div className="dw-p">
              <span className="k">Where</span>
              <span className="v">Google Meet · meet.google.com/kqz-vhdp-mte</span>
            </div>
          )}
          <div className="dw-p">
            <span className="k">Repeat</span>
            <span className="v" style={{ color: 'var(--ink3)' }}>
              {repeatLabel}
            </span>
          </div>
          <div className="dw-p last">
            <span className="k">Reminder</span>
            <span className="v">10 minutes before</span>
          </div>
        </div>

        {critique && (
          <>
            <div className="dw-h">
              Guests
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12.5 }}>3 going</span>
            </div>
            {[
              { n: 'Umut Şahin', l: 'U', bg: '#1A1A1A', sub: 'You · Organizer' },
              { n: 'Ece Çelik', l: 'E', bg: '#F38020' },
              { n: 'Mert Kaya', l: 'M', bg: '#5B6578' }
            ].map((g) => (
              <div className="dw-guest" key={g.n}>
                <span className="dw-av" style={{ background: g.bg }}>
                  {g.l}
                </span>
                <span>{g.n}</span>
                {g.sub && <span className="s">{g.sub}</span>}
                <span style={{ flex: 1 }} />
                <span className="s">Going</span>
              </div>
            ))}
            <div className={cn('dw-guest', 'last')} style={{ color: 'var(--ink3)' }}>
              <Icon name="plus" size={14} strokeWidth={2} round />
              Add guest
            </div>

            <div className="dw-h" style={{ paddingTop: 28 }}>
              Prepare
            </div>
            <div
              className="dw-guest"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/notes/n1')}
            >
              <Icon name="docPlain" size={16} strokeWidth={1.7} round />
              <span>Design critique prep</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Note · 3 action items</span>
            </div>
            <div className="dw-guest last">
              <span className="dw-cb" />
              <span>Prepare 3 home screen variations</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Today 14:30 · 30m</span>
            </div>
          </>
        )}
      </div>

      <div className="dw-foot">
        <span
          style={{
            fontSize: 13.5,
            color: onDelete ? 'var(--err)' : 'var(--ink2)',
            cursor: onDelete ? 'pointer' : undefined
          }}
          onClick={onDelete}
        >
          Delete
        </span>
        <span style={{ flex: 1 }} />
        <Button>Reschedule</Button>
        {critique && (
          <Button variant="dark" onClick={() => navigate('/notes/n1')}>
            Open note
          </Button>
        )}
      </div>
    </Drawer>
  )
}
