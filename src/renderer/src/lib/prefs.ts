import { useUI, type AppPrefs } from '../store/ui'
import { setDateStyle } from './clock'

/**
 * Applies Settings › Preferences everywhere. This module subscribes to the UI store at import time
 * (main.tsx imports it first), so the values are in place before any page renders and follow
 * every change, including the ones that arrive when an account's settings load.
 */

let hour12 = false

/** Rewrites every 24-hour clock time in a string for the chosen format: "14:30" → "2:30 PM". */
export function T(text: string): string {
  if (!hour12) return text
  return text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_m, h: string, m: string) => {
    const n = Number(h)
    return `${n % 12 || 12}:${m} ${n < 12 ? 'AM' : 'PM'}`
  })
}

/** A single "HH:MM" for display (hour labels and the like). */
export const clockLabel = (hhmm: string): string => T(hhmm)

function apply(p: AppPrefs): void {
  hour12 = p.timeFormat === '12-hour'
  setDateStyle(p.dateFormat)
  const root = document.documentElement
  root.dataset.density = p.density === 'Compact' ? 'compact' : 'comfortable'
  root.dataset.reduceMotion = p.reduceMotion ? 'true' : 'false'
}

apply(useUI.getState().prefs)
let last = useUI.getState().prefs
useUI.subscribe((s) => {
  if (s.prefs === last) return
  last = s.prefs
  apply(s.prefs)
})
