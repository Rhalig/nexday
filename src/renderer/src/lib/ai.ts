import type { Project } from '../data/tasks'
import { dayKey, appToday } from './clock'
import { supabase } from './supabase'

/**
 * Client for the `ai` Edge Function. Nothing here calls Gemini directly: the function holds the key,
 * enforces the monthly limit and counts each call in `ai_usage`.
 */
export type AiError = {
  error: string
  unavailable?: boolean
  limited?: boolean
  used?: number
  limit?: number
}
export type AiResult<T> = { data: T } | AiError

export type AiCapture = {
  kind: 'task' | 'event' | 'note'
  title: string
  project: Project
  date: string | null
  start: string | null
  end: string | null
  allDay: boolean
  energy: 'Deep focus' | 'Light'
  summary: string
}

export type AiInbox = {
  kind: 'task' | 'event' | 'note'
  when: string | null
  project: Project
  duration: string | null
  reason: string
}

export type AiActionItem = { title: string; when?: string | null }

const isError = (v: unknown): v is { error: string } =>
  typeof v === 'object' && v !== null && 'error' in v

async function call<T>(action: string, payload: Record<string, unknown>): Promise<AiResult<T>> {
  if (!supabase) {
    return { error: 'AI needs a Nexday account.', unavailable: true }
  }
  const { data, error } = await supabase.functions.invoke('ai', {
    body: { action, today: dayKey(appToday()), ...payload }
  })

  if (error) {
    // A non-2xx answer carries the Response; read what the function actually said.
    const res = (error as { context?: Response }).context
    const status = res?.status
    let code = ''
    try {
      const body = (await res?.clone().json()) as { error?: string; message?: string } | undefined
      code = String(body?.error ?? body?.message ?? '')
    } catch {
      /* not JSON */
    }
    if (status === 429 || code === 'limit') return { error: 'This month’s AI limit is used up.', limited: true }
    if (code === 'notConfigured') {
      return { error: 'AI is not set up yet. Add GEMINI_API_KEY to the ai function secrets.', unavailable: true }
    }
    if (status === 401 || status === 403) {
      return { error: 'AI could not verify your sign-in. Sign out and in again.' + (code ? ` (${code})` : ''), unavailable: true }
    }
    if (status === 404) return { error: 'The ai function is not deployed.', unavailable: true }
    if (status) return { error: `AI answered with an error (${status}${code ? `: ${code}` : ''}). Try again in a moment.` }
    return { error: 'Could not reach the AI service. Check your connection.' }
  }
  if (isError(data)) {
    if (data.error === 'limit') {
      return {
        error: 'This month’s AI limit is used up.',
        limited: true,
        used: (data as { used?: number }).used,
        limit: (data as { limit?: number }).limit
      }
    }
    if (data.error === 'notConfigured') {
      return {
        error: 'AI is not set up yet. Add GEMINI_API_KEY to the ai function secrets.',
        unavailable: true
      }
    }
    return { error: 'AI could not answer. Try again in a moment.' }
  }
  const payloadData = (data as { data?: T } | null)?.data
  if (!payloadData) return { error: 'AI returned an empty answer.' }
  return { data: payloadData }
}

export const aiParseCapture = (text: string): Promise<AiResult<AiCapture>> =>
  call<AiCapture>('parse', { text })

export const aiInboxSuggestion = (
  title: string,
  meta: string,
  source: string
): Promise<AiResult<AiInbox>> => call<AiInbox>('inbox', { title, meta, source })

export const aiNoteActions = (
  title: string,
  text: string
): Promise<AiResult<{ items: AiActionItem[] }>> => call('note', { title, text })

/** "2026-11-24 15:00", "2026-11-24", "15:00" → { date, time }. Anything else gives nulls. */
export function splitWhen(raw: string | null | undefined): { date: string | null; time: string | null } {
  const m = (raw ?? '').trim().match(/^(?:(\d{4}-\d{2}-\d{2}))?[ T]?(\d{1,2}:\d{2})?/)
  return { date: m?.[1] ?? null, time: m?.[2] ? m[2].padStart(5, '0') : null }
}

/** "30 min", "1 hour", "1h 30m", "45m" → minutes (null when unreadable or silly). */
export function minutesFrom(raw: string | null | undefined): number | null {
  const m = (raw ?? '').toLowerCase().match(/(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hour)s?)?\s*(?:(\d+)\s*(?:m|min)(?:ute)?s?)?/)
  const n = Math.round((m?.[1] ? Number(m[1]) * 60 : 0) + (m?.[2] ? Number(m[2]) : 0))
  return n >= 5 && n <= 960 ? n : null
}
