import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { startCloud, stopCloud } from '../lib/cloud'
import { AUTH_REDIRECT, supabase } from '../lib/supabase'

/**
 * Who is signed in. With Supabase configured this is the real session; without it (no .env) the app
 * falls back to a local-only mock so development still works.
 */
const KEY = 'nexday.auth'
// Set when a reset link is requested; the link itself only carries a code, so this is how the app
// knows the next sign-in comes from "Forgot password" rather than a normal login or confirmation.
const RESET_KEY = 'nexday.reset.requested'
const RESET_TTL = 60 * 60 * 1000

const rememberReset = (): void => {
  try {
    localStorage.setItem(RESET_KEY, String(Date.now()))
  } catch {
    /* storage unavailable */
  }
}

const forgetReset = (): void => {
  try {
    localStorage.removeItem(RESET_KEY)
  } catch {
    /* ignore */
  }
}

const resetWasRequested = (): boolean => {
  try {
    const at = Number(localStorage.getItem(RESET_KEY))
    return !!at && Date.now() - at < RESET_TTL
  } catch {
    return false
  }
}

// Set only after a reset link was actually opened, and kept until the new password is saved, so
// closing the app mid-way does not drop the person into the planner with the old password.
const RECOVERY_KEY = 'nexday.recovery.pending'

const markRecovery = (): void => {
  try {
    localStorage.setItem(RECOVERY_KEY, '1')
  } catch {
    /* ignore */
  }
}

const clearRecovery = (): void => {
  try {
    localStorage.removeItem(RECOVERY_KEY)
  } catch {
    /* ignore */
  }
}

const recoveryPending = (): boolean => {
  try {
    return localStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

type Saved = { signedIn: boolean; name: string; email: string }

function loadMock(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Saved
  } catch {
    /* storage unavailable */
  }
  return { signedIn: false, name: '', email: '' }
}

const persistMock = (s: Saved): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export type AuthResult = { error?: string; needsConfirm?: boolean }

type AuthState = Saved & {
  /** True once the saved session has been read, so screens do not flash the login page */
  ready: boolean
  /** Supabase is set up (otherwise: local mock) */
  configured: boolean
  userId: string | null
  /** True after a reset link was opened: the app must ask for a new password before anything else. */
  recovery: boolean
  init: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  cancelRecovery: () => void
  signOut: () => Promise<void>
  /** Mock sign-in, only used when Supabase is not configured */
  signIn: (p: { name?: string; email?: string }) => void
}

const nameFrom = (s: Session | null): string => {
  const meta = s?.user.user_metadata as { name?: string; full_name?: string } | undefined
  return meta?.name || meta?.full_name || (s?.user.email ? s.user.email.split('@')[0] : '')
}

const friendly = (message: string): string => {
  if (/invalid login credentials/i.test(message))
    return 'That email and password don’t match. Try again or reset your password.'
  if (/email not confirmed/i.test(message))
    return 'Confirm your email first. We sent you a link when you signed up.'
  if (/already registered|already been registered/i.test(message))
    return 'An account with this email already exists. Log in instead.'
  if (/rate limit|too many/i.test(message)) return 'Too many tries. Wait a minute and try again.'
  if (/auth session missing|token has expired|invalid.*token/i.test(message))
    return 'That reset link has expired. Request a new one from the login screen.'
  if (/different from the old password/i.test(message))
    return 'Choose a password you have not used before.'
  if (/password/i.test(message) && /characters|weak/i.test(message))
    return 'Use a longer password (at least 8 characters).'
  return message
}

export const useAuth = create<AuthState>((set, get) => ({
  ...loadMock(),
  ready: !supabase,
  configured: !!supabase,
  userId: null,
  recovery: false,

  init: async () => {
    const sb = supabase
    if (!sb) return
    const apply = (s: Session | null): void => {
      set({
        signedIn: !!s,
        name: nameFrom(s),
        email: s?.user.email ?? '',
        userId: s?.user.id ?? null,
        ready: true
      })
      if (s) void startCloud(s.user.id)
      else stopCloud()
    }
    const { data } = await sb.auth.getSession()
    apply(data.session)
    // Opened the reset link earlier, then quit before saving the new password.
    if (data.session && recoveryPending()) set({ recovery: true })
    sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        markRecovery()
        set({ recovery: true })
      }
      apply(s)
    })
    // Sign-in, confirmation and reset links open nexday://auth/callback?code=…
    window.api?.onAuthCallback(async (link) => {
      const u = new URL(link)
      const code = u.searchParams.get('code')
      // PKCE reset links carry only a code, so fall back to "a reset was asked for recently".
      const isRecovery = u.searchParams.get('type') === 'recovery' || resetWasRequested()
      if (!code) return
      const { error } = await sb.auth.exchangeCodeForSession(code)
      if (error) return
      if (isRecovery) {
        markRecovery()
        set({ recovery: true })
      } else {
        forgetReset()
      }
    })
  },

  signInWithPassword: async (email, password) => {
    if (!supabase) return { error: 'not configured' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: friendly(error.message) }
    forgetReset()
    clearRecovery()
    set({ recovery: false })
    return {}
  },

  signUp: async (name, email, password) => {
    if (!supabase) return { error: 'not configured' }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: AUTH_REDIRECT }
    })
    if (error) return { error: friendly(error.message) }
    // With email confirmation on there is no session until the link is opened
    return { needsConfirm: !data.session }
  },

  resetPassword: async (email) => {
    if (!supabase) return { error: 'not configured' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT
    })
    if (error) return { error: friendly(error.message) }
    rememberReset()
    return {}
  },

  updatePassword: async (password) => {
    if (!supabase) return { error: 'not configured' }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: friendly(error.message) }
    forgetReset()
    clearRecovery()
    set({ recovery: false })
    return {}
  },

  cancelRecovery: () => {
    forgetReset()
    clearRecovery()
    set({ recovery: false })
  },


  signOut: async () => {
    if (supabase) await supabase.auth.signOut()
    forgetReset()
    clearRecovery()
    const s = { signedIn: false, name: '', email: '' }
    persistMock(s)
    set({ ...s, userId: null, recovery: false })
  },

  signIn: ({ name, email }) => {
    const s = { signedIn: true, name: name ?? get().name, email: email ?? get().email }
    persistMock(s)
    set({ ...s, recovery: false })
  }
}))
