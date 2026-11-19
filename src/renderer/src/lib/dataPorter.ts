import type { Energy, Project, Task, TaskGroup } from '../data/tasks'
import { addDays, appToday, daysFromToday, weekdayShort } from './clock'
import { supabase } from './supabase'
import { useAuth } from '../store/auth'

/* ============================================================ export */

const TABLES = [
  'projects',
  'tasks',
  'inbox_items',
  'habits',
  'habit_checkins',
  'notes',
  'events',
  'notifications'
] as const

type Row = Record<string, unknown>

/** Every row of a table the person owns (RLS limits it to them), read a page at a time. */
async function allRows(table: string): Promise<Row[]> {
  const sb = supabase!
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  return out
}

const stamp = (): string => new Date().toISOString().slice(0, 10)

export type Exported = { name: string; text: string }

/** Everything Nexday holds about the account, as one JSON document. */
export async function buildJsonExport(): Promise<Exported | { error: string }> {
  if (!supabase) return { error: 'Sign in to export your data.' }
  try {
    const tables: Record<string, Row[]> = {}
    for (const t of TABLES) tables[t] = await allRows(t)
    const prof = await supabase.from('profiles').select('*').maybeSingle()
    const doc = {
      app: 'nexday',
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { email: useAuth.getState().email },
      profile: prof.data ?? null,
      tables
    }
    return { name: `nexday-export-${stamp()}.json`, text: JSON.stringify(doc, null, 2) }
  } catch (e) {
    console.error('[export]', e)
    return { error: 'Could not read all of your data. Check your connection and try again.' }
  }
}

const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? '' : String(v)
  // Spreadsheet apps run text that starts with = + - @ as a formula: keep it text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Tasks (open and done) as a CSV any spreadsheet or task app can read. */
export async function buildTasksCsv(): Promise<Exported | { error: string }> {
  if (!supabase) return { error: 'Sign in to export your data.' }
  try {
    const [tasks, projects] = await Promise.all([allRows('tasks'), allRows('projects')])
    const names = new Map(projects.map((p) => [String(p.id), String(p.name)]))
    const head = ['title', 'status', 'project', 'energy', 'estimate_min', 'scheduled_start', 'completed_at', 'notes']
    const lines = [head.join(',')]
    for (const t of tasks) {
      if (t.deleted_at) continue
      lines.push(
        [
          t.title,
          t.status,
          names.get(String(t.project_id)) ?? '',
          t.energy,
          t.estimate_min,
          t.scheduled_start,
          t.completed_at,
          t.notes
        ]
          .map(csvCell)
          .join(',')
      )
    }
    return { name: `nexday-tasks-${stamp()}.csv`, text: '﻿' + lines.join('\r\n') + '\r\n' }
  } catch (e) {
    console.error('[export]', e)
    return { error: 'Could not read your tasks. Check your connection and try again.' }
  }
}

/** Saves through the native dialog in the app, or a normal download in a browser. */
export async function saveExport(file: Exported): Promise<{ saved: boolean; where?: string }> {
  if (window.api?.files) {
    const r = await window.api.files.save(file.name, file.text)
    return r ? { saved: true, where: r.path } : { saved: false }
  }
  const url = URL.createObjectURL(new Blob([file.text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return { saved: true }
}

/* ============================================================ import */

export type ImportTask = {
  title: string
  project?: Project
  date?: Date
  hasTime?: boolean
  estimate?: number
  energy?: Energy
}

export type ParsedImport = { source: string; tasks: ImportTask[]; ignored: number }

const projectFromName = (name: unknown): Project | undefined => {
  const n = String(name ?? '').toLowerCase()
  if (!n) return undefined
  if (n.includes('planner') || n.includes('mvp')) return 'planner'
  if (n.includes('moving') || n.includes('house')) return 'moving'
  if (n.includes('reading') || n.includes('book')) return 'reading'
  if (n.includes('personal')) return 'personal'
  return undefined
}

/** A date from an export: "2026-11-20", "2026-11-20 14:30", ISO strings, or anything Date reads. */
function parseWhen(raw: unknown): { date?: Date; hasTime?: boolean } {
  const s = String(raw ?? '').trim()
  if (!s) return {}
  // Date only: keep it a local day (new Date("2026-11-20") would be UTC midnight).
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?Z)?$/)
  if (m) return { date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), hasTime: false }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/)
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s))
    return {
      date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])),
      hasTime: true
    }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return {}
  return { date: d, hasTime: /\d{1,2}:\d{2}/.test(s) }
}

/** CSV with quotes, CRLF, a BOM and either comma or semicolon separators. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const first = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = first.split(';').length > first.split(',').length ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

const pick = (head: string[], names: string[]): number =>
  head.findIndex((h) => names.includes(h))

function fromCsv(text: string): ParsedImport {
  const rows = parseCsv(text)
  if (rows.length < 2) return { source: 'CSV', tasks: [], ignored: 0 }
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const iTitle = pick(head, ['title', 'content', 'task', 'name', 'summary', 'task name'])
  const iType = pick(head, ['type'])
  const iStatus = pick(head, ['status', 'state', 'completed'])
  const iDate = pick(head, ['scheduled_start', 'date', 'due', 'due date', 'due_date', 'deadline', 'start'])
  const iProject = pick(head, ['project', 'list', 'project name'])
  const iEst = pick(head, ['estimate_min', 'estimate', 'duration'])
  const isTodoist = iType >= 0 && head.includes('content')
  const tasks: ImportTask[] = []
  let ignored = 0
  for (const r of rows.slice(1)) {
    const title = (r[iTitle >= 0 ? iTitle : 0] ?? '').trim()
    if (!title) continue
    if (isTodoist && (r[iType] ?? '').toLowerCase() !== 'task') {
      ignored++
      continue
    }
    const status = iStatus >= 0 ? (r[iStatus] ?? '').toLowerCase() : ''
    if (['done', 'completed', 'complete', 'true', 'yes', 'checked'].includes(status)) {
      ignored++
      continue
    }
    const est = iEst >= 0 ? Number(r[iEst]) : NaN
    tasks.push({
      title,
      project: iProject >= 0 ? projectFromName(r[iProject]) : undefined,
      ...(iDate >= 0 ? parseWhen(r[iDate]) : {}),
      ...(Number.isFinite(est) && est > 0 && est <= 960 ? { estimate: Math.round(est) } : {})
    })
  }
  return { source: isTodoist ? 'Todoist CSV' : 'CSV', tasks, ignored }
}

function fromJson(doc: unknown): ParsedImport {
  const obj = doc as Row
  // Nexday's own export
  if (obj && obj.app === 'nexday' && obj.tables) {
    const t = obj.tables as Record<string, Row[]>
    const slugOf = new Map((t.projects ?? []).map((p) => [String(p.id), String(p.slug ?? p.name)]))
    const tasks: ImportTask[] = []
    let ignored = 0
    for (const r of t.tasks ?? []) {
      if (r.deleted_at || r.status !== 'open' || !String(r.title ?? '').trim()) {
        ignored++
        continue
      }
      tasks.push({
        title: String(r.title).trim(),
        project: projectFromName(slugOf.get(String(r.project_id))),
        energy: r.energy === 'deep' ? 'Deep focus' : 'Light',
        estimate: typeof r.estimate_min === 'number' ? r.estimate_min : undefined,
        ...parseWhen(r.scheduled_start)
      })
    }
    return { source: 'Nexday export', tasks, ignored }
  }
  // Google Tasks (Takeout): { kind: 'tasks#taskLists', items: [{ items: [...] }] }
  if (obj && Array.isArray(obj.items) && (obj.items as Row[]).some((l) => Array.isArray(l.items))) {
    const tasks: ImportTask[] = []
    let ignored = 0
    for (const list of obj.items as Row[]) {
      for (const t of (list.items as Row[]) ?? []) {
        if (t.status === 'completed' || !String(t.title ?? '').trim()) {
          ignored++
          continue
        }
        tasks.push({
          title: String(t.title).trim(),
          project: projectFromName(list.title),
          ...parseWhen(t.due)
        })
      }
    }
    return { source: 'Google Tasks', tasks, ignored }
  }
  // A plain array of { title, ... }
  const list = Array.isArray(doc) ? (doc as Row[]) : Array.isArray(obj?.tasks) ? (obj.tasks as Row[]) : null
  if (list && list.every((x) => typeof x === 'object' && x)) {
    const tasks: ImportTask[] = []
    let ignored = 0
    for (const t of list) {
      const title = String(t.title ?? t.content ?? t.name ?? '').trim()
      if (!title || t.completed === true || t.done === true) {
        ignored++
        continue
      }
      tasks.push({ title, project: projectFromName(t.project), ...parseWhen(t.due ?? t.date) })
    }
    return { source: 'JSON', tasks, ignored }
  }
  return { source: 'JSON', tasks: [], ignored: 0 }
}

/** Reads a chosen file. Returns what it holds without touching the app yet. */
export function parseImport(name: string, text: string): ParsedImport | { error: string } {
  try {
    const trimmed = text.trimStart()
    const parsed =
      /\.csv$/i.test(name) || !/^[[{]/.test(trimmed) ? fromCsv(text) : fromJson(JSON.parse(text))
    if (parsed.tasks.length > 5000) return { error: 'That file has more than 5000 tasks. Split it first.' }
    if (parsed.tasks.length === 0)
      return { error: 'No open tasks were found in this file. Expected a Nexday export, a Google Tasks file or a CSV with a title column.' }
    return parsed
  } catch {
    return { error: 'This file could not be read. Use a Nexday export, a Google Tasks file or a CSV.' }
  }
}

const fmtLen = (n: number): string =>
  n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}` : `${n}m`

/** An imported task as the tasks store wants it. Only dated-with-a-time tasks get a slot. */
export function toStoreTask(
  it: ImportTask,
  defaultLength: number
): { task: Task; group: TaskGroup['id'] } {
  let group: TaskGroup['id'] = 'no-time'
  let time: string | null = null
  if (it.date && it.hasTime) {
    const diff = daysFromToday(it.date)
    const clock = `${String(it.date.getHours()).padStart(2, '0')}:${String(it.date.getMinutes()).padStart(2, '0')}`
    if (diff === 0 || diff === 1) {
      group = diff === 0 ? 'today' : 'tomorrow'
      time = `${clock} · ${fmtLen(it.estimate ?? defaultLength)}`
    } else if (diff >= 2 && diff <= 8) {
      group = 'next-week'
      time = `${weekdayShort(addDays(appToday(), diff))} ${clock}`
    }
  }
  return {
    group,
    task: {
      id: crypto.randomUUID(),
      title: it.title,
      project: it.project ?? 'personal',
      energy: it.energy ?? 'Light',
      time,
      ...(it.estimate ? { estimate: it.estimate } : {})
    }
  }
}
