import type { AppPrefs } from '../store/ui'

/**
 * Keyboard shortcuts that can be changed in Settings › Shortcuts.
 * A combo is written "Mod+Shift+P": Mod is ⌘ (or Ctrl), then optional Shift/Alt, then one key.
 */
export type ShortcutId = 'palette' | 'settings' | 'shortcuts' | 'newTask' | 'newEvent' | 'newNote' | 'newProject'

export const SHORTCUTS: Array<{ id: ShortcutId; label: string; group: 'General' | 'Create'; def: string }> = [
  { id: 'palette', label: 'Search or command', group: 'General', def: 'Mod+K' },
  { id: 'settings', label: 'Open settings', group: 'General', def: 'Mod+,' },
  { id: 'shortcuts', label: 'Show all shortcuts', group: 'General', def: 'Mod+/' },
  { id: 'newTask', label: 'New task', group: 'Create', def: 'Mod+T' },
  { id: 'newEvent', label: 'New event', group: 'Create', def: 'Mod+E' },
  { id: 'newNote', label: 'New note', group: 'Create', def: 'Mod+N' },
  { id: 'newProject', label: 'New project', group: 'Create', def: 'Mod+Shift+P' }
]

/** Go to pages with "G" then a letter (when single-key shortcuts are on). */
export const GO_TO: Array<{ key: string; label: string; path: string }> = [
  { key: 'T', label: 'Today', path: '/today' },
  { key: 'I', label: 'Inbox', path: '/inbox' },
  { key: 'C', label: 'Calendar', path: '/calendar' },
  { key: 'K', label: 'Tasks', path: '/tasks' },
  { key: 'N', label: 'Notes', path: '/notes' },
  { key: 'H', label: 'Habits', path: '/habits' }
]

/** Combos the system or the text fields already use. */
const RESERVED = new Set(['Mod+C', 'Mod+V', 'Mod+X', 'Mod+A', 'Mod+Z', 'Mod+Shift+Z', 'Mod+Q', 'Mod+W', 'Mod+R', 'Mod+M', 'Mod+H'])

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt', 'AltGraph', 'CapsLock'])

/** The combo an event represents, or null when it is not a usable shortcut (needs ⌘/Ctrl plus one key). */
export function comboOf(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key) || (!e.metaKey && !e.ctrlKey)) return null
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  return ['Mod', e.shiftKey ? 'Shift' : '', e.altKey ? 'Alt' : '', key].filter(Boolean).join('+')
}

/** Why a combo cannot be used, or null when it is fine. */
export function problemWith(combo: string, id: ShortcutId, map: Record<ShortcutId, string>): string | null {
  if (RESERVED.has(combo)) return 'That one is used by macOS or text fields.'
  const other = SHORTCUTS.find((s) => s.id !== id && map[s.id] === combo)
  return other ? `Already used by “${other.label}”.` : null
}

export function resolveShortcuts(prefs: Pick<AppPrefs, 'shortcuts'>): Record<ShortcutId, string> {
  const out = {} as Record<ShortcutId, string>
  for (const s of SHORTCUTS) out[s.id] = prefs.shortcuts?.[s.id] || s.def
  return out
}

/** "Mod+Shift+P" → ["⌘", "⇧", "P"] */
export function keycaps(combo: string): string[] {
  return combo.split(/\+(?=.)/).map((k) => (k === 'Mod' ? '⌘' : k === 'Shift' ? '⇧' : k === 'Alt' ? '⌥' : k))
}
