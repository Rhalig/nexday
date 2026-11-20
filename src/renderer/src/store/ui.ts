import { create } from 'zustand'

export type NewType = 'task' | 'event' | 'note' | 'habit'
export type PanelName = 'profile' | 'notifs' | 'help' | 'newProject'
export type DialogName =
  'autoSchedule' | 'inboxRules' | 'templates' | 'projectSettings' | 'share'

/** What Settings › Planning changes, and what the scheduler follows. */
export type PlanSettings = {
  /** Monday first */
  workDays: boolean[]
  lunchStart: string
  lunchEnd: string
  /** Minutes */
  defaultLength: number
  /** Minutes of breathing room around meetings */
  buffer: number
  deepFocusHours: number
  useEnergy: boolean
  moveUnfinished: boolean
  reserveHabits: boolean
  askFirst: boolean
}

export const DEFAULT_PLAN: PlanSettings = {
  workDays: [true, true, true, true, true, false, false],
  lunchStart: '12:30',
  lunchEnd: '13:30',
  defaultLength: 30,
  buffer: 10,
  deepFocusHours: 4,
  useEnergy: true,
  moveUnfinished: true,
  reserveHabits: true,
  askFirst: false
}

export type AppPrefs = {
  language: 'English' | 'Türkçe'
  timeFormat: '24-hour' | '12-hour'
  dateFormat: '17 Nov 2026' | 'Nov 17, 2026' | '2026-11-17'
  startPage: 'Today' | 'Calendar' | 'Inbox'
  density: 'Comfortable' | 'Compact'
  sounds: boolean
  reduceMotion: boolean
  showCompleted: boolean
  /** Changed shortcuts only (id → "Mod+K"); missing ids use their default */
  shortcuts: Record<string, string>
  /** "G then a letter" to jump between pages */
  singleKey: boolean
}

export const DEFAULT_PREFS: AppPrefs = {
  language: 'English',
  timeFormat: '24-hour',
  dateFormat: '17 Nov 2026',
  startPage: 'Today',
  density: 'Comfortable',
  sounds: true,
  reduceMotion: false,
  showCompleted: true,
  shortcuts: {},
  singleKey: true
}

export type NotifPrefs = {
  quietStart: string
  quietEnd: string
  quietOn: boolean
  remind: '5 minutes before' | '10 minutes before' | '30 minutes before'
  /** Daily plan, Up next, Inbox suggestions, Tasks due today, Habits, Weekly review, Shared */
  matrix: boolean[][]
}

export const DEFAULT_NOTIFS: NotifPrefs = {
  quietStart: '22:00',
  quietEnd: '08:00',
  quietOn: true,
  remind: '10 minutes before',
  matrix: [
    [true, false, true],
    [true, false, true],
    [false, false, true],
    [true, false, true],
    [true, false, false],
    [false, true, false],
    [true, true, true]
  ]
}

/** Per-project switches kept with the account (by project key). */
export type ProjectPref = { sidebar?: boolean; auto?: boolean; description?: string; weekly?: number; color?: string }

export type CalPrefs = {
  syncDirection: 'Two-way' | 'Calendar to Nexday'
  newEventCalendar: 'Personal' | 'Work' | 'Planner MVP'
  showDeclined: boolean
  /** Mac calendars switched off in Settings › Calendars (by title) */
  hiddenCalendars: string[]
}

export const DEFAULT_CAL_PREFS: CalPrefs = {
  syncDirection: 'Two-way',
  newEventCalendar: 'Personal',
  showDeclined: false,
  hiddenCalendars: []
}

const cleanMatrix = (raw: unknown): boolean[][] =>
  Array.isArray(raw) && raw.length === 7 && raw.every((r) => Array.isArray(r) && r.length === 3)
    ? (raw as boolean[][]).map((r) => r.map(Boolean))
    : DEFAULT_NOTIFS.matrix

/** Anything older or partial in profiles.settings is filled with the defaults. */
export function mergePrefs(raw: unknown): AppPrefs {
  const r = { ...DEFAULT_PREFS, ...((raw ?? {}) as Partial<AppPrefs>) }
  if (!r.shortcuts || typeof r.shortcuts !== 'object') r.shortcuts = {}
  return r
}

export function mergeNotifPrefs(raw: unknown): NotifPrefs {
  const r = (raw ?? {}) as Partial<NotifPrefs>
  return { ...DEFAULT_NOTIFS, ...r, matrix: cleanMatrix(r.matrix) }
}

export function mergeCalPrefs(raw: unknown): CalPrefs {
  const r = { ...DEFAULT_CAL_PREFS, ...((raw ?? {}) as Partial<CalPrefs>) }
  if (!Array.isArray(r.hiddenCalendars)) r.hiddenCalendars = []
  return r
}

/** Anything older or partial in profiles.settings is filled with the defaults. */
export function mergePlan(raw: unknown): PlanSettings {
  const p = (raw ?? {}) as Partial<PlanSettings>
  const days =
    Array.isArray(p.workDays) && p.workDays.length === 7
      ? p.workDays.map(Boolean)
      : DEFAULT_PLAN.workDays
  return {
    ...DEFAULT_PLAN,
    ...p,
    workDays: days,
    defaultLength: Number(p.defaultLength) || DEFAULT_PLAN.defaultLength,
    buffer: Number.isFinite(Number(p.buffer)) ? Number(p.buffer) : DEFAULT_PLAN.buffer,
    deepFocusHours: Number(p.deepFocusHours) || DEFAULT_PLAN.deepFocusHours
  }
}

type UIState = {
  palette: boolean
  newType: NewType | null
  newTitle: string
  panel: PanelName | null
  dialog: { name: DialogName; slug?: string } | null
  autoSchedule: boolean
  pauseNotifs: boolean
  planning: PlanSettings
  setPlanning: (patch: Partial<PlanSettings>) => void
  prefs: AppPrefs
  setPrefs: (patch: Partial<AppPrefs>) => void
  notifPrefs: NotifPrefs
  setNotifPrefs: (patch: Partial<NotifPrefs>) => void
  calPrefs: CalPrefs
  projectPrefs: Record<string, ProjectPref>
  setProjectPref: (key: string, patch: ProjectPref) => void
  setCalPrefs: (patch: Partial<CalPrefs>) => void
  openPalette: () => void
  closePalette: () => void
  openNew: (type: NewType, title?: string) => void
  closeNew: () => void
  /** The task whose detail drawer is open, wherever the person is */
  taskId: string | null
  openTask: (id: string) => void
  closeTask: () => void
  openPanel: (p: PanelName) => void
  closePanel: () => void
  openDialog: (name: DialogName, slug?: string) => void
  closeDialog: () => void
  toggle: (key: 'autoSchedule' | 'pauseNotifs') => void
}

export const useUI = create<UIState>((set) => ({
  palette: false,
  newType: null,
  newTitle: '',
  panel: null,
  dialog: null,
  autoSchedule: true,
  pauseNotifs: false,
  planning: DEFAULT_PLAN,
  setPlanning: (patch) => set((s) => ({ planning: { ...s.planning, ...patch } })),
  prefs: DEFAULT_PREFS,
  setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
  notifPrefs: DEFAULT_NOTIFS,
  setNotifPrefs: (patch) => set((s) => ({ notifPrefs: { ...s.notifPrefs, ...patch } })),
  calPrefs: DEFAULT_CAL_PREFS,
  projectPrefs: {},
  setProjectPref: (key, patch) => set((s) => ({ projectPrefs: { ...s.projectPrefs, [key]: { ...s.projectPrefs[key], ...patch } } })),
  setCalPrefs: (patch) => set((s) => ({ calPrefs: { ...s.calPrefs, ...patch } })),
  openPalette: () => set({ palette: true, newType: null, panel: null }),
  closePalette: () => set({ palette: false }),
  openNew: (type, title = '') =>
    set({ newType: type, newTitle: title, palette: false, panel: null }),
  closeNew: () => set({ newType: null, newTitle: '' }),
  openPanel: (p) => set({ panel: p, palette: false, newType: null }),
  closePanel: () => set({ panel: null }),
  openDialog: (name, slug) =>
    set({ dialog: { name, slug }, palette: false, newType: null, panel: null }),
  closeDialog: () => set({ dialog: null }),
  taskId: null,
  openTask: (id) => set({ taskId: id }),
  closeTask: () => set({ taskId: null }),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<UIState>)
}))

// Dev-only hook so overlays can be opened from the console while checking against the designs.
if (import.meta.env.DEV) {
  ;(window as unknown as { __nexday: unknown }).__nexday = {
    openNew: (type: NewType, title?: string) => useUI.getState().openNew(type, title),
    openPalette: () => useUI.getState().openPalette(),
    openPanel: (p: PanelName) => useUI.getState().openPanel(p)
  }
}
