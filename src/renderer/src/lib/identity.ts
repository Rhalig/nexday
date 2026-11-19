import { useAuth } from '../store/auth'

/** Who is signed in, ready for display. Nothing here is a placeholder person. */
export function useIdentity(): { name: string; first: string; email: string; initial: string } {
  const name = useAuth((s) => s.name)
  const email = useAuth((s) => s.email)
  const full = name.trim() || (email ? email.split('@')[0] : '')
  return {
    name: full || 'You',
    first: full.split(' ')[0] || 'there',
    email,
    initial: (full || email || '?').charAt(0).toUpperCase()
  }
}

export const greeting = (d: Date = new Date()): string => {
  const h = d.getHours()
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const timeZoneName = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}
