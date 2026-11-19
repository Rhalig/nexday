import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { QuickCapture } from '../../components/QuickCapture'
import { Button, cn } from '../../components/ui'
import { projectList, type ProjectData } from '../../data/projects'
import { useUI } from '../../store/ui'
import { useProjects } from '../../store/projects'
import './projects.css'

export default function Project(): React.JSX.Element {
  const { slug } = useParams()
  const custom = useProjects((s) => s.custom.find((c) => c.slug === slug))
  const project: ProjectData | undefined =
    projectList.find((p) => p.slug === slug) ??
    (custom && {
      slug: custom.slug,
      name: custom.name,
      color: custom.color,
      kicker: 'Project · New',
      summary: 'No tasks yet. Add the first one below.',
      stats: [
        ['Open', '0'],
        ['Done', '0'],
        ['This week', '0m']
      ],
      groups: [],
      doneCount: 0,
      card: { label: 'Just started', headline: '0 of 0 tasks done', pct: 0, text: 'Add your first task and Nexday finds a slot for it.' },
      sections: [],
      capture: {
        placeholder: `Add to ${custom.name}… "kick-off call Monday 10:00"`,
        hint: `New items here are filed under ${custom.name} automatically.`
      }
    })
  if (!project) return <Navigate to="/projects/planner-mvp" replace />
  return <ProjectView key={project.slug} project={project} />
}

function ProjectView({ project: p }: { project: ProjectData }): React.JSX.Element {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)

  return (
    <main className="panel pj">
      <div className="pj-top">
        <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color }} />
        <span style={{ fontSize: 13, color: 'var(--ink3)' }}>Projects</span>
        <span style={{ color: '#BDBDBA' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
        <span style={{ flex: 1 }} />
        <Button style={{ marginRight: p.shareable ? 12 : 12 }}>Synced with Calendar · 2 min ago</Button>
        {p.shareable && (
          <Button style={{ marginRight: 12 }} onClick={() => useUI.getState().openDialog('share', p.slug)}>
            <Icon name="share" size={14} round />
            Share
          </Button>
        )}
        <Button variant="dark">+ New</Button>
      </div>

      <div className="panel-scroll">
        <div className="pj-head">
          <div className="col" style={{ gap: 6, flex: 1 }}>
            <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{p.kicker}</span>
            <span className="pj-title">{p.name}</span>
            <span style={{ fontSize: 13.5, color: 'var(--ink2)', marginTop: 4 }}>{p.summary}</span>
          </div>
          <div className="pj-stats">
            {p.stats.map(([label, value], i) => (
              <div className="row" key={label} style={{ height: '100%' }}>
                {i > 0 && <div className="pj-vr" />}
                <div className="pj-stat">
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="pj-rule" />

        {p.tabs && (
          <div className="row" style={{ marginTop: 24 }}>
            <div className="pj-seg">
              {p.tabs.map((t, i) => (
                <button key={t.label} className={cn(i === tab && 'on')} onClick={() => setTab(i)}>
                  {t.label} <i>{t.count}</i>
                </button>
              ))}
            </div>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>Sorted by date</span>
          </div>
        )}

        <div className="pj-body">
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            {p.groups.map((g) => (
              <div className="col" key={g.title}>
                <div className="pj-gh">
                  {g.title}
                  <i>{g.meta}</i>
                </div>
                {g.tasks.map((t) => (
                  <div className="pj-t" key={t.title}>
                    <button className="pj-cb" aria-label="Complete" />
                    <span className="n">{t.title}</span>
                    <span className="e">{t.energy}</span>
                    <span className={cn('w', t.when === null && 'hot')}>{t.when ?? 'Find a time'}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="pj-done">
              <Icon name="caretRight" size={14} strokeWidth={2} round />
              Done · {p.doneCount}
            </div>
          </div>

          <div className="pj-side">
            <div className="pj-card">
              <div className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
                {p.card.label}
              </div>
              <span style={{ fontSize: 22, fontWeight: 500, marginTop: 6 }}>{p.card.headline}</span>
              <div className="pj-bar">
                <i style={{ width: `${p.card.pct}%`, background: p.color }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>{p.card.text}</span>
              <div className="row" style={{ marginTop: 12 }}>
                <span
                  style={{ fontSize: 13.5, color: 'var(--ink2)', cursor: 'pointer' }}
                  onClick={() => useUI.getState().openDialog('projectSettings', p.slug)}
                >
                  Edit project
                </span>
                <span style={{ flex: 1 }} />
                <Button variant="dark" onClick={() => navigate('/tasks')}>
                  Plan this week
                </Button>
              </div>
            </div>

            {p.sections.map((s, si) => (
              <div className="col" key={s.title}>
                <div className="pj-rh" style={si === 0 ? { paddingTop: 26 } : undefined}>
                  {s.title}
                  <span style={{ flex: 1 }} />
                  {s.link && <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--ink2)', cursor: 'pointer' }}>{s.link}</span>}
                </div>
                {s.rows.map((r, i) => (
                  <div className={cn('pj-rl', i === 0 && 'top')} key={r.title}>
                    {r.bar && <span className="pj-rl-bar" style={{ background: r.bar }} />}
                    {r.milestone === 'done' && (
                      <span style={{ color: '#F38020', display: 'flex' }}>
                        <Icon name="check" size={16} strokeWidth={2.4} round />
                      </span>
                    )}
                    {r.milestone === 'todo' && <span className="pj-ms" />}
                    <span>{r.title}</span>
                    <span style={{ flex: 1 }} />
                    <span className="m">{r.meta}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <QuickCapture placeholder={p.capture.placeholder} button="Add" hint={p.capture.hint} />
    </main>
  )
}
