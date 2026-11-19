import { create } from 'zustand'
import type { IconName } from '../components/Icon'
import { supabase } from '../lib/supabase'

export type Notif = {
  id: string
  group: 'Today' | 'Yesterday'
  unread: boolean
  mention?: boolean
  /** Either a glyph or an avatar letter */
  glyph?: IconName | 'boltFill'
  avatar?: { letter: string; color: string }
  /** Bold lead + rest of the title */
  lead: string
  rest?: string
  body: string
  actions?: string[]
  time: string
}

export const sampleNotifs: Notif[] = [
  { id: 'a', group: 'Today', unread: true, glyph: 'boltFill', lead: 'Your plan changed', body: 'Nexday moved Pitch draft to 17:00, when your energy picks up.', actions: ['Undo', 'See day'], time: '08:32' },
  { id: 'b', group: 'Today', unread: true, mention: true, avatar: { letter: 'E', color: '#F38020' }, lead: 'Ece Çelik', rest: ' mentioned you in Design critique prep', body: '"Can you add the empty states before 15:00?"', actions: ['Open note'], time: '09:48' },
  { id: 'c', group: 'Today', unread: true, glyph: 'calendarLg', lead: 'Product sync', rest: ' starts in 50 minutes', body: '11:30 – 12:30 · Google Meet', time: '10:40' },
  { id: 'd', group: 'Today', unread: false, glyph: 'tray', lead: '2 new items in your Inbox', body: 'Nexday found times for both.', actions: ['Review'], time: '08:30' },
  { id: 'e', group: 'Yesterday', unread: false, glyph: 'clock', lead: 'Morning run', rest: ' streak is 12 days', body: 'Two more mornings and you reach a 2-week streak.', time: '07:35' },
  { id: 'f', group: 'Yesterday', unread: false, avatar: { letter: 'M', color: '#5B6578' }, lead: 'Mert Kaya', rest: ' shared a note with you', body: 'Component spec · Planner MVP', time: '17:12' },
  { id: 'g', group: 'Yesterday', unread: false, glyph: 'syncSm', lead: 'Google Calendar', rest: ' synced', body: '14 events added to your week.', time: '09:02' }
]

type NotifState = {
  items: Notif[]
  markAllRead: () => void
  /** Removes every notification (they are also deleted in the account) */
  clear: () => void
  toggleRead: (id: string) => void
}

export const useNotifs = create<NotifState>((set) => ({
  items: supabase ? [] : sampleNotifs,
  clear: () => set({ items: [] }),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, unread: false })) })),
  toggleRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, unread: false } : n)) }))
}))

export const unreadCount = (items: Notif[]): number => items.filter((n) => n.unread).length
