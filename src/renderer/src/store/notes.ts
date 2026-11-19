import { create } from 'zustand'
import { notes as sampleNotes, type Note } from '../data/notes'
import { withinLimit } from '../lib/plan'
import { supabase } from '../lib/supabase'

type NotesState = {
  notes: Note[]
  /** A new note starts as an idea for today; the editor fills in the rest later. */
  add: (title: string) => string | null
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
  }
}))
