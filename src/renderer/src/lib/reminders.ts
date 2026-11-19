import type { ImportTask, ParsedImport } from './dataPorter'

/** Apple Reminders through the same Mac helper as the calendar. Open reminders can be imported as tasks. */
export type RemindersStatus =
  'unavailable' | 'unknown' | 'notDetermined' | 'denied' | 'restricted' | 'writeOnly' | 'authorized'

type Raw = { id: string; title: string; list?: string; due?: string; hasTime?: boolean }

const isErr = (v: unknown): v is { error: string } => typeof v === 'object' && v !== null && 'error' in v

export async function remindersStatus(): Promise<RemindersStatus> {
  const api = window.api?.reminders
  if (!api) return 'unavailable'
  const r = await api.status()
  return isErr(r) ? 'unavailable' : ((r as { status: RemindersStatus }).status ?? 'unavailable')
}

export async function requestReminders(): Promise<RemindersStatus> {
  const api = window.api?.reminders
  if (!api) return 'unavailable'
  await api.request()
  return remindersStatus()
}

/** Open reminders as an import preview (the same dialog as Settings › Data & privacy › Import). */
export async function loadReminders(): Promise<ParsedImport | { error: string }> {
  const api = window.api?.reminders
  if (!api) return { error: 'unavailable' }
  const raw = await api.list()
  if (isErr(raw) || !Array.isArray(raw)) return { error: 'failed' }
  const tasks: ImportTask[] = []
  let ignored = 0
  for (const r of raw as Raw[]) {
    const title = String(r.title ?? '').trim().slice(0, 200)
    if (!title) {
      ignored++
      continue
    }
    const date = r.due ? new Date(r.due) : undefined
    tasks.push({
      title,
      ...(date && !Number.isNaN(date.getTime()) ? { date, hasTime: r.hasTime === true } : {})
    })
  }
  return { source: 'Apple Reminders', tasks, ignored }
}
