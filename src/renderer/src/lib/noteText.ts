import type { Note } from '../data/notes'

/**
 * A note's content is plain text with three light conventions, one per line:
 *   "# Heading", "- bullet", "[ ] action item" ("[x]" done, "[>]" already sent to the plan).
 * Everything else is a paragraph. The editor, the preview and the Notes list all read it here.
 */

export type NoteLine =
  | { kind: 'blank'; raw: string }
  | { kind: 'h'; raw: string; text: string }
  | { kind: 'bullet'; raw: string; text: string }
  | { kind: 'todo'; raw: string; text: string; state: 'open' | 'done' | 'sent' }
  | { kind: 'p'; raw: string; text: string }

export function parseLine(raw: string): NoteLine {
  if (!raw.trim()) return { kind: 'blank', raw }
  let m = raw.match(/^\s*\[( |x|X|>)\]\s?(.*)$/)
  if (m)
    return {
      kind: 'todo',
      raw,
      text: m[2],
      state: m[1] === ' ' ? 'open' : m[1] === '>' ? 'sent' : 'done'
    }
  m = raw.match(/^\s*#{1,3}\s+(.*)$/)
  if (m) return { kind: 'h', raw, text: m[1] }
  m = raw.match(/^\s*[-*•]\s+(.*)$/)
  if (m) return { kind: 'bullet', raw, text: m[1] }
  return { kind: 'p', raw, text: raw }
}

export const parseNote = (text: string): NoteLine[] => text.split('\n').map(parseLine)

/** The note's text. Notes made before the editor existed carry a structured body: turn it into text once. */
export function noteText(n: Pick<Note, 'text' | 'body' | 'summary'>): string {
  if (typeof n.text === 'string') return n.text
  const b = n.body
  if (b) {
    const out: string[] = []
    if (b.goals.length) out.push('# Goals', ...b.goals.map((g) => `- ${g}`), '')
    if (b.questions) out.push('# Open questions', b.questions, '')
    if (b.actionItems.length)
      out.push('# Action items', ...b.actionItems.map((a) => `[ ] ${a.title}`))
    return out.join('\n').trimEnd()
  }
  return n.summary
}

/** The line shown under the title in lists: the first real sentence, without markers. */
export function summaryOf(text: string): string {
  for (const l of parseNote(text)) {
    if (l.kind === 'blank' || l.kind === 'h') continue
    const t = l.text.trim()
    if (t) return t.length > 110 ? t.slice(0, 107) + '…' : t
  }
  return ''
}

export type ActionItem = { index: number; title: string; state: 'open' | 'done' | 'sent' }

export function actionItems(text: string): ActionItem[] {
  const out: ActionItem[] = []
  parseNote(text).forEach((l, index) => {
    if (l.kind === 'todo' && l.text.trim()) out.push({ index, title: l.text.trim(), state: l.state })
  })
  return out
}

/** How many action items a note still has open (not done, not yet in the plan). */
export const openActionCount = (n: Pick<Note, 'text' | 'body' | 'summary'>): number =>
  actionItems(noteText(n)).filter((a) => a.state === 'open').length

/** Rewrites one line's state marker, keeping the rest of the text. */
export function setTodoState(text: string, index: number, state: 'open' | 'done' | 'sent'): string {
  const lines = text.split('\n')
  const mark = state === 'open' ? ' ' : state === 'done' ? 'x' : '>'
  lines[index] = lines[index].replace(/\[( |x|X|>)\]/, `[${mark}]`)
  return lines.join('\n')
}
