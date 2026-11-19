import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The Supabase client. The publishable key is meant to be public; what protects the data is row level
 * security in the database. The login session is kept in the Mac keychain (via the main process),
 * not in localStorage.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const secure = window.api?.secure
const storage = secure
  ? {
      getItem: (k: string) => secure.get(k),
      setItem: (k: string, v: string) => secure.set(k, v),
      removeItem: (k: string) => secure.remove(k)
    }
  : undefined // plain browser: supabase-js falls back to localStorage

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false, // links arrive through the nexday:// handler, not the address bar
          storage
        }
      })
    : null

export const AUTH_REDIRECT = 'nexday://auth/callback'
