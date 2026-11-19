import { create } from 'zustand'
import { taskGroups, type Energy, type Project, type Task, type TaskGroup } from '../data/tasks'
import { initialHabits, type Habit } from '../data/habits'
import { notes as sampleNotes, type Note, type NoteCategory } from '../data/notes'
import { sampleInbox, useInbox, type InboxItem } from '../store/inbox'
import { sampleNotifs, useNotifs, type Notif } from '../store/notifs'
import { useHabits } from '../store/habits'
import { useNotes } from '../store/notes'
import { useCalendar, type PlanEvent } from '../store/calendar'
import { useProjects, type CustomProject } from '../store/projects'
import { removalMode, useTasks } from '../store/tasks'
import {
  DEFAULT_CAL_PREFS,
  DEFAULT_NOTIFS,
  DEFAULT_PLAN,
  DEFAULT_PREFS,
  mergeCalPrefs,
  mergeNotifPrefs,
  mergePlan,
  mergePrefs,
  useUI
} from '../store/ui'
import { addDays, appToday, dayKey, daysFromToday, startOfWeek } from './clock'
import { usePlan } from './plan'
import { supabase } from './supabase'

/**
 * Cloud sync. The stores stay the single place the screens read from and write to. This file
 *   1. loads a signed-in person's rows into the stores,
 *   2. watches the stores and saves every change to Supabase (the screen updates first, the save follows),
 *   3. puts sample data into a brand-new account once, so the app is not empty on day one.
 * Set SAMPLE_DATA to false to start new accounts empty.
 */
const SAMPLE_DATA = true

type Row = Record<string, unknown>

/* ---------------------------------------------------------------- sync status */

export type SyncState = 'idle' | 'saving' | 'error'
export const useSync = create<{
  state: SyncState
  ready: boolean
  error: string | null
  lastSync: number | null
}>(() => ({
  state: 'idle',
  ready: false,
  error: null,
  lastSync: null
}))

let chain: Promise<void> = Promise.resolve()
let pendingWrites = 0

/** Writes run one after another so a later change can never land before an earlier one. */
function enqueue(
  label: string,
  op: () => PromiseLike<{ error: { message: string } | null }>
): void {
  pendingWrites++
  useSync.setState({ state: 'saving' })
  chain = chain.then(async () => {
    try {
      let r = await op()
      if (r.error) {
        // one quiet retry for a dropped connection
        await new Promise((res) => setTimeout(res, 1500))
        r = await op()
      }
      if (r.error) throw new Error(r.error.message)
      pendingWrites--
      useSync.setState({
        state: pendingWrites === 0 ? 'idle' : 'saving',
        error: null,
        lastSync: Date.now()
      })
    } catch (e) {
      pendingWrites--
      console.error(`[cloud] ${label} failed`, e)
      useSync.setState({ state: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  })
}

/* ---------------------------------------------------------------- mapping: tasks */

const SLUG: Record<Project, string> = {
  planner: 'planner-mvp',
  moving: 'moving-house',
  reading: 'reading-list',
  personal: 'personal'
}
const BASE_PROJECTS: Array<{ slug: string; name: string; color: string }> = [
  { slug: 'planner-mvp', name: 'Planner MVP', color: 'var(--acc)' },
  { slug: 'moving-house', name: 'Moving house', color: 'var(--work)' },
  { slug: 'reading-list', name: 'Reading list', color: 'var(--personal)' },
  { slug: 'personal', name: 'Personal', color: 'var(--health)' }
]
const slugToKey = (slug: string): Project | null =>
  (Object.keys(SLUG) as Project[]).find((k) => SLUG[k] === slug) ?? null

/** project slug → project row id, filled when the account is loaded */
let projectIds: Record<string, string> = {}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// "Next week" tasks are written as "Mon 09:30" and land on Monday+ of the week after this one.
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6
}

const hhmm = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const fmtLen = (n: number): string =>
  n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}` : `${n}m`

function parseLen(label: string | undefined): number | null {
  const m = label?.match(/^(?:(\d+)h)?\s?(?:(\d+)m)?$/)
  if (!m || (!m[1] && !m[2])) return null
  return (m[1] ? Number(m[1]) * 60 : 0) + (m[2] ? Number(m[2]) : 0)
}

/** "09:30 · 30m" / "Mon 09:30" in a day group → start, end and estimate */
function schedule(
  group: TaskGroup['id'],
  time: string | null,
  estimateHint?: number
): { start: string | null; end: string | null; est: number | null } {
  if (group === 'no-time' || time === null)
    return { start: null, end: null, est: estimateHint ?? null }
  let day: Date
  let clock: string
  let est = estimateHint ?? null
  if (group === 'next-week') {
    const [wd, c] = time.split(' ')
    day = addDays(addDays(startOfWeek(appToday()), 7), WEEKDAY_INDEX[wd] ?? 0)
    clock = c ?? '09:00'
  } else {
    day = addDays(appToday(), group === 'tomorrow' ? 1 : 0)
    const [c, len] = time.split(' · ')
    clock = c
    est = parseLen(len) ?? est
  }
  const [h, m] = clock.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return { start: null, end: null, est }
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
  const end = est ? new Date(start.getTime() + est * 60000) : null
  return { start: start.toISOString(), end: end ? end.toISOString() : null, est }
}

const energyOut = (e: Energy): string => (e === 'Deep focus' ? 'deep' : 'light')
const energyIn = (e: string): Energy => (e === 'deep' ? 'Deep focus' : 'Light')

function taskRow(t: Task, group: TaskGroup['id'], estimateHint?: number): Row {
  const s = schedule(group, t.time, estimateHint)
  return {
    id: t.id,
    title: t.title,
    project_id: projectIds[SLUG[t.project]] ?? null,
    energy: energyOut(t.energy),
    estimate_min: s.est,
    scheduled_start: s.start,
    scheduled_end: s.end,
    status: 'open',
    deleted_at: null
  }
}

function groupsFromRows(rows: Row[]): TaskGroup[] {
  const idToSlug: Record<string, string> = {}
  for (const [slug, id] of Object.entries(projectIds)) idToSlug[id] = slug
  const buckets: Record<TaskGroup['id'], Array<{ task: Task; est: number }>> = {
    today: [],
    tomorrow: [],
    'next-week': [],
    'no-time': []
  }
  const sorted = [...rows].sort((a, b) => {
    const as = (a.scheduled_start as string | null) ?? '9999'
    const bs = (b.scheduled_start as string | null) ?? '9999'
    return as === bs
      ? String(a.created_at).localeCompare(String(b.created_at))
      : as.localeCompare(bs)
  })
  for (const r of sorted) {
    const project = slugToKey(idToSlug[String(r.project_id)] ?? '') ?? 'personal'
    const start = r.scheduled_start ? new Date(String(r.scheduled_start)) : null
    const est = (r.estimate_min as number | null) ?? 0
    let group: TaskGroup['id'] = 'no-time'
    let time: string | null = null
    if (start) {
      const diff = daysFromToday(start)
      if (diff <= 0) group = 'today'
      else if (diff === 1) group = 'tomorrow'
      else group = 'next-week'
      time =
        group === 'next-week'
          ? `${WEEKDAYS[start.getDay()]} ${hhmm(start)}`
          : `${hhmm(start)} · ${est ? fmtLen(est) : '30m'}`
    }
    buckets[group].push({
      task: {
        id: String(r.id),
        title: String(r.title),
        project,
        energy: energyIn(String(r.energy)),
        time
      },
      est
    })
  }
  const titles: Record<TaskGroup['id'], string> = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    'next-week': 'Next week',
    'no-time': 'No time yet'
  }
  return (Object.keys(buckets) as TaskGroup['id'][])
    .filter((id) => buckets[id].length > 0)
    .map((id) => {
      const total = buckets[id].reduce((n, x) => n + x.est, 0)
      return {
        id,
        title: titles[id],
        meta: total ? `${buckets[id].length} · ${fmtLen(total)}` : String(buckets[id].length),
        tasks: buckets[id].map((x) => x.task)
      }
    })
}

/* ---------------------------------------------------------------- mapping: inbox, habits, notifications */

type InboxPayload = {
  suggestion: InboxItem['suggestion']
  focus?: InboxItem['focus']
  group: InboxItem['group']
}

const inboxRow = (i: InboxItem): Row => ({
  id: i.id,
  source: i.source,
  title: i.title,
  meta: i.meta,
  suggestion: { suggestion: i.suggestion, focus: i.focus, group: i.group } satisfies InboxPayload,
  state: 'new',
  deleted_at: null
})
const inboxFromRow = (r: Row): InboxItem => {
  const p = r.suggestion as InboxPayload
  return {
    id: String(r.id),
    source: r.source as InboxItem['source'],
    group: p.group,
    title: String(r.title),
    meta: String(r.meta),
    suggestion: p.suggestion,
    focus: p.focus
  }
}

const lenMinutes = (label: string): number => {
  const m = label.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?/)
  return (m?.[1] ? Number(m[1]) * 60 : 0) + (m?.[2] ? Number(m[2]) : 0) || 5
}

const habitRow = (h: Habit): Row => ({
  id: h.id,
  name: h.name,
  time_of_day: h.time,
  length_min: lenMinutes(h.length),
  meta: {
    sub: h.sub,
    length: h.length,
    slotEnd: h.slotEnd,
    group: h.group,
    rate: h.rate,
    streak: h.streak,
    checkIns: h.checkIns,
    upNextIn: h.upNextIn,
    upNextNote: h.upNextNote
  },
  deleted_at: null
})
const habitFromRow = (r: Row, doneToday: boolean): Habit => {
  const m = r.meta as Omit<Habit, 'id' | 'name' | 'time' | 'doneToday'>
  return {
    id: String(r.id),
    name: String(r.name),
    time: String(r.time_of_day).slice(0, 5),
    doneToday,
    ...m
  }
}

const notifRow = (n: Notif): Row => ({
  id: n.id,
  kind: 'ui',
  title: n.lead,
  body: n.body,
  payload: n,
  read_at: n.unread ? null : new Date().toISOString(),
  deleted_at: null
})
const notifFromRow = (r: Row): Notif => ({
  ...(r.payload as Notif),
  id: String(r.id),
  unread: r.read_at === null
})

/* ---------------------------------------------------------------- mapping: notes, events */

// The design's chips are not all real projects ("Work", "Ideas"), so the chip is kept in the body JSON.
const CHIP_SLUG: Record<string, string> = {
  'Planner MVP': 'planner-mvp',
  'Moving house': 'moving-house',
  'Reading list': 'reading-list',
  Personal: 'personal'
}

const noteRow = (n: Note): Row => ({
  id: n.id,
  project_id: projectIds[CHIP_SLUG[n.chip.name]] ?? null,
  event_id: null,
  linked_event_title: n.linked ?? null,
  title: n.title,
  body: {
    summary: n.summary,
    group: n.group,
    category: n.category,
    chip: n.chip,
    when: n.when,
    linked: n.linked ?? null,
    edited: n.edited,
    body: n.body ?? null
  },
  template: null,
  category: n.category,
  pinned: false,
  deleted_at: null
})

const noteFromRow = (r: Row): Note => {
  const b = (r.body ?? {}) as Row
  return {
    id: String(r.id),
    title: String(r.title),
    summary: String(b.summary ?? ''),
    group: (b.group as Note['group']) ?? 'today',
    category: (r.category as NoteCategory) ?? 'ideas',
    chip: (b.chip as Note['chip']) ?? { color: 'var(--health)', name: 'Ideas' },
    when: (b.when as Note['when']) ?? { text: 'Today' },
    linked: (b.linked as string | null) ?? undefined,
    edited: String(b.edited ?? 'Edited just now'),
    body: (b.body as Note['body']) ?? undefined
  }
}

const eventRow = (e: PlanEvent): Row => ({
  id: e.id,
  title: e.title,
  starts_at: e.startsAt,
  ends_at: e.endsAt,
  all_day: !!e.allDay,
  location: e.location ?? null,
  kind: e.kind,
  rrule: e.rrule ?? null,
  external_source: e.externalId ? 'mac' : null,
  external_id: e.externalId ?? null,
  deleted_at: null
})

const eventFromRow = (r: Row): PlanEvent => ({
  id: String(r.id),
  title: String(r.title),
  startsAt: String(r.starts_at),
  endsAt: String(r.ends_at),
  kind: String(r.kind) as PlanEvent['kind'],
  location: (r.location as string | null) ?? null,
  allDay: r.all_day === true,
  rrule: (r.rrule as string | null) ?? null,
  externalId: (r.external_id as string | null) ?? null
})

/* ---------------------------------------------------------------- snapshots: what the database already has */

type Snap = Map<string, string>
const last: Record<string, Snap> = {
  tasks: new Map(),
  inbox: new Map(),
  habits: new Map(),
  checkins: new Map(),
  notifs: new Map(),
  projects: new Map(),
  settings: new Map(),
  notes: new Map(),
  events: new Map()
}

const flatTasks = (groups: TaskGroup[]): Array<{ t: Task; g: TaskGroup['id'] }> =>
  groups.flatMap((g) => g.tasks.map((t) => ({ t, g: g.id })))
const taskSnap = (groups: TaskGroup[]): Snap =>
  new Map(flatTasks(groups).map(({ t, g }) => [t.id, JSON.stringify({ ...t, g })]))
const inboxSnap = (items: InboxItem[]): Snap => new Map(items.map((i) => [i.id, JSON.stringify(i)]))
const habitSnap = (hs: Habit[]): Snap =>
  new Map(hs.map((h) => [h.id, JSON.stringify({ ...h, doneToday: undefined })]))
const checkinSnap = (hs: Habit[]): Snap => new Map(hs.map((h) => [h.id, String(h.doneToday)]))
const notifSnap = (ns: Notif[]): Snap => new Map(ns.map((n) => [n.id, JSON.stringify(n)]))
const projectSnap = (ps: CustomProject[]): Snap =>
  new Map(ps.filter((p) => p.id).map((p) => [p.id!, JSON.stringify(p)]))
const noteSnap = (ns: Note[]): Snap => new Map(ns.map((n) => [n.id, JSON.stringify(n)]))
const eventSnap = (es: PlanEvent[]): Snap => new Map(es.map((e) => [e.id, JSON.stringify(e)]))

const changed = (prev: Snap, next: Snap): { upsert: string[]; removed: string[] } => ({
  upsert: [...next.keys()].filter((id) => prev.get(id) !== next.get(id)),
  removed: [...prev.keys()].filter((id) => !next.has(id))
})

/* ---------------------------------------------------------------- saving */

const TODAY = (): string => dayKey(appToday())

function saveTasks(groups: TaskGroup[]): void {
  const sb = supabase!
  const next = taskSnap(groups)
  const { upsert, removed } = changed(last.tasks, next)
  last.tasks = next
  const byId = new Map(flatTasks(groups).map((x) => [x.t.id, x]))
  if (upsert.length) {
    const rows = upsert.map((id) => taskRow(byId.get(id)!.t, byId.get(id)!.g))
    enqueue('save tasks', () => sb.from('tasks').upsert(rows))
  }
  for (const id of removed) {
    const mode = removalMode.get(id) ?? 'done'
    removalMode.delete(id)
    const patch =
      mode === 'deleted'
        ? { deleted_at: new Date().toISOString() }
        : { status: 'done', completed_at: new Date().toISOString() }
    enqueue('finish task', () => sb.from('tasks').update(patch).eq('id', id))
  }
}

function saveInbox(items: InboxItem[]): void {
  const sb = supabase!
  const next = inboxSnap(items)
  const { upsert, removed } = changed(last.inbox, next)
  last.inbox = next
  if (upsert.length) {
    const byId = new Map(items.map((i) => [i.id, i]))
    const rows = upsert.map((id) => inboxRow(byId.get(id)!))
    enqueue('save inbox', () => sb.from('inbox_items').upsert(rows))
  }
  for (const id of removed)
    enqueue('resolve inbox item', () =>
      sb.from('inbox_items').update({ state: 'resolved' }).eq('id', id)
    )
}

function saveHabits(habits: Habit[]): void {
  const sb = supabase!
  const next = habitSnap(habits)
  const { upsert } = changed(last.habits, next)
  last.habits = next
  if (upsert.length) {
    const byId = new Map(habits.map((h) => [h.id, h]))
    const rows = upsert.map((id) => habitRow(byId.get(id)!))
    enqueue('save habits', () => sb.from('habits').upsert(rows))
  }
  const cn = checkinSnap(habits)
  const c = changed(last.checkins, cn)
  const prevCheck = last.checkins
  last.checkins = cn
  for (const id of c.upsert) {
    if (cn.get(id) === 'true')
      enqueue('check in', () =>
        sb
          .from('habit_checkins')
          .upsert(
            { habit_id: id, day: TODAY(), done: true, deleted_at: null },
            { onConflict: 'habit_id,day' }
          )
      )
    else if (prevCheck.get(id) === 'true')
      enqueue('undo check in', () =>
        sb.from('habit_checkins').delete().eq('habit_id', id).eq('day', TODAY())
      )
  }
}

function saveNotifs(items: Notif[]): void {
  const sb = supabase!
  const next = notifSnap(items)
  const { upsert } = changed(last.notifs, next)
  last.notifs = next
  if (!upsert.length) return
  const byId = new Map(items.map((n) => [n.id, n]))
  const rows = upsert.map((id) => notifRow(byId.get(id)!))
  enqueue('save notifications', () => sb.from('notifications').upsert(rows))
}

function saveProjects(custom: CustomProject[]): void {
  const sb = supabase!
  const next = projectSnap(custom)
  const { upsert } = changed(last.projects, next)
  last.projects = next
  if (!upsert.length) return
  const byId = new Map(custom.filter((p) => p.id).map((p) => [p.id!, p]))
  const rows = upsert.map((id) => ({
    id,
    name: byId.get(id)!.name,
    slug: byId.get(id)!.slug,
    color: byId.get(id)!.color,
    deleted_at: null
  }))
  for (const r of rows) projectIds[String(r.slug)] = String(r.id)
  enqueue('save projects', () => sb.from('projects').upsert(rows))
}

function saveNotes(items: Note[]): void {
  const sb = supabase!
  const next = noteSnap(items)
  const { upsert, removed } = changed(last.notes, next)
  last.notes = next
  if (upsert.length) {
    const byId = new Map(items.map((n) => [n.id, n]))
    const rows = upsert.map((id) => noteRow(byId.get(id)!))
    enqueue('save notes', () => sb.from('notes').upsert(rows))
  }
  for (const id of removed)
    enqueue('delete note', () =>
      sb.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    )
}

function saveEvents(own: PlanEvent[]): void {
  const sb = supabase!
  const next = eventSnap(own)
  const { upsert, removed } = changed(last.events, next)
  last.events = next
  if (upsert.length) {
    const byId = new Map(own.map((e) => [e.id, e]))
    const rows = upsert.map((id) => eventRow(byId.get(id)!))
    enqueue('save events', () => sb.from('events').upsert(rows))
  }
  for (const id of removed)
    enqueue('delete event', () =>
      sb.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    )
}

function saveSettings(): void {
  const sb = supabase!
  const { autoSchedule, pauseNotifs, planning, prefs, notifPrefs, calPrefs } = useUI.getState()
  const block = { autoSchedule, pauseNotifs, planning, prefs, notifPrefs, calPrefs }
  const next = JSON.stringify(block)
  if (last.settings.get('ui') === next) return
  last.settings.set('ui', next)
  enqueue('save settings', async () => {
    const { data } = await sb.auth.getUser()
    if (!data.user) return { error: null }
    const cur = await sb.from('profiles').select('settings').eq('user_id', data.user.id).single()
    const settings = { ...((cur.data?.settings as Row) ?? {}), ...block }
    return sb.from('profiles').update({ settings }).eq('user_id', data.user.id)
  })
}

/* ---------------------------------------------------------------- loading and seeding */

let unsubscribe: Array<() => void> = []
let currentUser: string | null = null

async function ensureProjects(userId: string): Promise<Row[]> {
  const sb = supabase!
  const got = await sb.from('projects').select('*').is('deleted_at', null)
  if (got.error) throw got.error
  const have = new Set((got.data ?? []).map((p) => String(p.slug)))
  const missing = BASE_PROJECTS.filter((p) => !have.has(p.slug))
  if (missing.length === 0) return got.data ?? []
  const ins = await sb
    .from('projects')
    .insert(missing.map((p, i) => ({ ...p, user_id: userId, position: i })))
  if (ins.error) throw ins.error
  const again = await sb.from('projects').select('*').is('deleted_at', null)
  if (again.error) throw again.error
  return again.data ?? []
}

const SAMPLE_ESTIMATES: Record<string, number> = {
  'Review PR #48 for the day view': 45,
  'Review the component spec for Mert': 30,
  'Order new desk lamp': 20,
  'Update portfolio with Planner case study': 80
}

async function seedSample(userId: string): Promise<void> {
  const sb = supabase!
  const idMap = new Map<string, string>()
  const fresh = (old: string): string => {
    const id = crypto.randomUUID()
    idMap.set(old, id)
    return id
  }
  const tasks = taskGroups.flatMap((g) =>
    g.tasks.map((t) => taskRow({ ...t, id: fresh(t.id) }, g.id, SAMPLE_ESTIMATES[t.title]))
  )
  const inbox = sampleInbox.map((i) => inboxRow({ ...i, id: fresh(i.id) }))
  const habitsList = initialHabits.map((h) => ({ ...h, id: fresh(h.id) }))
  const notifs = sampleNotifs.map((n) => notifRow({ ...n, id: fresh(n.id) }))
  const check = habitsList
    .filter((h) => h.doneToday)
    .map((h) => ({ habit_id: h.id, day: TODAY(), done: true, user_id: userId }))
  const results = await Promise.all([
    sb.from('tasks').insert(tasks.map((r) => ({ ...r, user_id: userId }))),
    sb.from('inbox_items').insert(inbox.map((r) => ({ ...r, user_id: userId }))),
    sb.from('habits').insert(habitsList.map((h) => ({ ...habitRow(h), user_id: userId }))),
    sb.from('notifications').insert(notifs.map((r) => ({ ...r, user_id: userId })))
  ])
  for (const r of results) if (r.error) throw r.error
  if (check.length) {
    const c = await sb.from('habit_checkins').insert(check)
    if (c.error) throw c.error
  }
}

async function seedNotes(userId: string): Promise<void> {
  const sb = supabase!
  // A second apart each, so "order by created_at" keeps the design's list order.
  const now = Date.now()
  const rows = sampleNotes.map((n, i) => ({
    ...noteRow({ ...n, id: crypto.randomUUID() }),
    user_id: userId,
    created_at: new Date(now + i * 1000).toISOString()
  }))
  const ins = await sb.from('notes').insert(rows)
  if (ins.error) throw ins.error
}

async function loadAll(userId: string): Promise<void> {
  const sb = supabase!
  const prof = await sb.from('profiles').select('settings').eq('user_id', userId).maybeSingle()
  let settings = ((prof.data?.settings as Row | null) ?? {}) as Row
  let projects = await ensureProjects(userId)
  projectIds = Object.fromEntries(projects.map((p) => [String(p.slug), String(p.id)]))

  if (SAMPLE_DATA && !settings.seeded) {
    // Only a brand-new account (nothing saved yet) gets the sample content.
    const existing = await sb.from('tasks').select('id', { count: 'exact', head: true })
    if ((existing.count ?? 0) === 0) await seedSample(userId)
    settings = { ...settings, seeded: true }
    const mark = await sb.from('profiles').update({ settings }).eq('user_id', userId)
    if (mark.error) throw mark.error
    projects = (await sb.from('projects').select('*').is('deleted_at', null)).data ?? projects
  }

  if (SAMPLE_DATA && !settings.notesSeeded) {
    // Notes were added after the first sample seeding, so older accounts get them once too.
    const existing = await sb.from('notes').select('id', { count: 'exact', head: true })
    if ((existing.count ?? 0) === 0) await seedNotes(userId)
    settings = { ...settings, notesSeeded: true }
    const mark = await sb.from('profiles').update({ settings }).eq('user_id', userId)
    if (mark.error) throw mark.error
  }

  const [tasks, inbox, habits, checks, notifs, noteRows, eventRows] = await Promise.all([
    sb.from('tasks').select('*').eq('status', 'open').is('deleted_at', null),
    sb
      .from('inbox_items')
      .select('*')
      .eq('state', 'new')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    sb.from('habits').select('*').is('deleted_at', null).order('created_at', { ascending: true }),
    sb
      .from('habit_checkins')
      .select('habit_id')
      .eq('day', TODAY())
      .eq('done', true)
      .is('deleted_at', null),
    sb
      .from('notifications')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    sb.from('notes').select('*').is('deleted_at', null).order('created_at', { ascending: true }),
    sb.from('events').select('*').is('deleted_at', null).order('starts_at', { ascending: true })
  ])
  for (const r of [tasks, inbox, habits, checks, notifs, noteRows, eventRows])
    if (r.error) throw r.error

  const done = new Set((checks.data ?? []).map((c) => String(c.habit_id)))
  const custom: CustomProject[] = projects
    .filter((p) => !slugToKey(String(p.slug)))
    .map((p) => ({
      id: String(p.id),
      slug: String(p.slug),
      name: String(p.name),
      color: String(p.color)
    }))

  // Fill the stores, then record what we just loaded as "already saved" so it is not written back.
  useTasks.setState({ groups: groupsFromRows(tasks.data ?? []) })
  useInbox.setState({ items: (inbox.data ?? []).map(inboxFromRow) })
  useHabits.setState({
    habits: (habits.data ?? []).map((r) => habitFromRow(r, done.has(String(r.id))))
  })
  useNotifs.setState({ items: (notifs.data ?? []).map(notifFromRow) })
  useNotes.setState({ notes: (noteRows.data ?? []).map(noteFromRow) })
  useCalendar.getState().setOwn((eventRows.data ?? []).map(eventFromRow))
  useProjects.setState({ custom })
  useUI.setState({
    autoSchedule: settings.autoSchedule !== false,
    pauseNotifs: settings.pauseNotifs === true,
    planning: mergePlan(settings.planning),
    prefs: mergePrefs(settings.prefs),
    notifPrefs: mergeNotifPrefs(settings.notifPrefs),
    calPrefs: mergeCalPrefs(settings.calPrefs)
  })

  last.tasks = taskSnap(useTasks.getState().groups)
  last.inbox = inboxSnap(useInbox.getState().items)
  last.habits = habitSnap(useHabits.getState().habits)
  last.checkins = checkinSnap(useHabits.getState().habits)
  last.notifs = notifSnap(useNotifs.getState().items)
  last.projects = projectSnap(useProjects.getState().custom)
  last.notes = noteSnap(useNotes.getState().notes)
  last.events = eventSnap(useCalendar.getState().own)
  last.settings = new Map([
    [
      'ui',
      JSON.stringify({
        autoSchedule: useUI.getState().autoSchedule,
        pauseNotifs: useUI.getState().pauseNotifs,
        planning: useUI.getState().planning,
        prefs: useUI.getState().prefs,
        notifPrefs: useUI.getState().notifPrefs,
        calPrefs: useUI.getState().calPrefs
      })
    ]
  ])
}

/** Called when someone signs in: load their data, then start saving changes. */
export async function startCloud(userId: string): Promise<void> {
  if (!supabase || currentUser === userId) return
  currentUser = userId
  useSync.setState({ ready: false, state: 'idle', error: null })
  try {
    await loadAll(userId)
    await usePlan.getState().load()
  } catch (e) {
    console.error('[cloud] load failed', e)
    useSync.setState({ state: 'error', error: e instanceof Error ? e.message : String(e) })
  }
  unsubscribe.forEach((u) => u())
  unsubscribe = [
    useTasks.subscribe((s, p) => s.groups !== p.groups && saveTasks(s.groups)),
    useInbox.subscribe((s, p) => s.items !== p.items && saveInbox(s.items)),
    useHabits.subscribe((s, p) => s.habits !== p.habits && saveHabits(s.habits)),
    useNotifs.subscribe((s, p) => s.items !== p.items && saveNotifs(s.items)),
    useProjects.subscribe((s, p) => s.custom !== p.custom && saveProjects(s.custom)),
    useNotes.subscribe((s, p) => s.notes !== p.notes && saveNotes(s.notes)),
    useCalendar.subscribe((s, p) => s.own !== p.own && saveEvents(s.own)),
    useUI.subscribe(
      (s, p) =>
        (s.autoSchedule !== p.autoSchedule ||
          s.pauseNotifs !== p.pauseNotifs ||
          s.planning !== p.planning ||
          s.prefs !== p.prefs ||
          s.notifPrefs !== p.notifPrefs ||
          s.calPrefs !== p.calPrefs) &&
        saveSettings()
    )
  ]
  useSync.setState({ ready: true })
}

/** Called on sign-out: stop saving and clear everything that belonged to the person. */
export function stopCloud(): void {
  unsubscribe.forEach((u) => u())
  unsubscribe = []
  currentUser = null
  projectIds = {}
  for (const k of Object.keys(last)) last[k] = new Map()
  useTasks.setState({ groups: [] })
  useInbox.setState({ items: [] })
  useHabits.setState({ habits: [] })
  useNotifs.setState({ items: [] })
  useProjects.setState({ custom: [] })
  useNotes.setState({ notes: [] })
  useCalendar.getState().reset()
  usePlan.getState().reset()
  useUI.setState({
    autoSchedule: true,
    pauseNotifs: false,
    planning: DEFAULT_PLAN,
    prefs: DEFAULT_PREFS,
    notifPrefs: DEFAULT_NOTIFS,
    calPrefs: DEFAULT_CAL_PREFS
  })
  useSync.setState({ ready: false, state: 'idle', error: null })
}
