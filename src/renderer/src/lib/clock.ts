/** The app's "now". Everything day-based goes through here. */
export const appToday = (): Date => new Date()

export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Local midnight of the date in a "YYYY-MM-DD" key. */
export const parseDayKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (d: Date): number => (d.getDay() + 6) % 7

/** Monday of the week that contains d. */
export const startOfWeek = (d: Date): Date => {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1)

export const sameDay = (a: Date, b: Date): boolean => dayKey(a) === dayKey(b)

/** Whole days from the app's today to the given date (negative = past) */
export const daysFromToday = (d: Date): number => {
  const t = appToday()
  return Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) /
      86400000
  )
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

export const weekdayLong = (d: Date): string => WEEKDAY_LONG[d.getDay()]
export const weekdayShort = (d: Date): string => WEEKDAY_SHORT[d.getDay()]
export const monthLong = (d: Date): string => MONTH_LONG[d.getMonth()]
export const monthShort = (d: Date): string => MONTH_SHORT[d.getMonth()]

let dateStyle: '17 Nov 2026' | 'Nov 17, 2026' | '2026-11-17' = '17 Nov 2026'
/** Set from Settings › Preferences (see lib/prefs.ts). */
export const setDateStyle = (s: typeof dateStyle): void => {
  dateStyle = s
}

/** "Thursday, 19 Nov 2026" / "Thursday, Nov 19, 2026" / "Thursday, 2026-11-19" — the line above every page title. */
export const pageDate = (d: Date = appToday()): string => {
  const day =
    dateStyle === '2026-11-17'
      ? dayKey(d)
      : dateStyle === 'Nov 17, 2026'
        ? `${monthShort(d)} ${d.getDate()}, ${d.getFullYear()}`
        : `${d.getDate()} ${monthShort(d)} ${d.getFullYear()}`
  return `${weekdayLong(d)}, ${day}`
}

/** "Nov 19, 2026" */
export const shortDate = (d: Date): string =>
  dateStyle === '2026-11-17'
    ? dayKey(d)
    : dateStyle === 'Nov 17, 2026'
      ? `${monthShort(d)} ${d.getDate()}, ${d.getFullYear()}`
      : `${d.getDate()} ${monthShort(d)} ${d.getFullYear()}`

/** "19:30" from a date. */
export const clockTime = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
