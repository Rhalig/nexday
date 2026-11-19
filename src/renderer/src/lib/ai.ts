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
    const status = (error as { context?: { status?: number } }).context?.status
    if (status === 429) return { error: 'This month’s AI limit is used up.', limited: true }
    return {
      error: 'AI is not set up yet. Deploy the ai function and add GEMINI_API_KEY.',
      unavailable: true
    }
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
