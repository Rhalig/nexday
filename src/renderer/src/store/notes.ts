import { create } from 'zustand'
import { notes as sampleNotes, type Note } from '../data/notes'
import { withinLimit } from '../lib/plan'
import { summaryOf } from '../lib/noteText'
import { appToday, clockTime } from '../lib/clock'
import { supabase } from '../lib/supabase'

type NotesState = {
  notes: Note[]
  /** A new note starts as an idea for today; the editor fills in the rest later. */
  add: (title: string) => string | null
  /** Saves edits from the editor. The list preview line follows the text. */
  update: (id: string, patch: { title?: string; text?: string }) => void
  remove: (id: string) => void
}

export const useNotes = create<NotesState>((set, get) => ({
  notes: supabase ? [] : sampleNotes,
  add: (title) => {
    if (!withinLimit('notes', get().notes.length)) return null
    const id = crypto.randomUUID()
    const note: Note = {
      id,
      title: title.trim() || 'Untitled note',
      summary: '',
      group: 'today',
      category: 'ideas',
      chip: { color: 'var(--health)', name: 'Ideas' },
      when: { text: 'Just now' },
      edited: 'Edited just now'
    }
    set((s) => ({ notes: [note, ...s.notes] }))
    return id
  },
  update: (id, patch) =>
    set((s) => ({
      notes: s.notes.map((n) => {
        if (n.id !== id) return n
        const title = patch.title !== undefined ? patch.title : n.title
        const text = patch.text !== undefined ? patch.text : n.text
        return {
          ...n,
          title,
          ...(text !== undefined ? { text, summary: summaryOf(text) } : {}),
          // The structured sample body is replaced by the text once someone edits.
          ...(patch.text !== undefined ? { body: undefined } : {}),
          edited: `Edited today at ${clockTime(appToday())}`
        }
      })
    })),
  remove: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
}))
