import { supabase } from './supabase'
import { kv } from './persist'
import { useAuth } from '../store/auth'

/**
 * Permanently deletes the signed-in account: the `delete-account` Edge Function cancels any paid
 * plan and removes the user (the database cascades the rest). On success the app signs out and
 * forgets what it kept on this Mac.
 */
export async function deleteAccount(): Promise<{ error?: string }> {
  if (!supabase) {
    await useAuth.getState().signOut()
    return {}
  }
  const userId = useAuth.getState().userId
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { action: 'delete' }
  })
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status
    if (status === 404) return { error: 'Account deletion is not available yet. Please contact support.' }
    if (status === 503)
      return { error: 'Your subscription could not be cancelled right now. Nothing was deleted.' }
    if (status === 502)
      return { error: 'Cancelling your subscription failed, so nothing was deleted. Try again.' }
    return { error: 'Could not delete the account. Nothing was deleted. Try again in a moment.' }
  }
  if (!(data as { ok?: boolean } | null)?.ok) {
    return { error: 'Could not delete the account. Nothing was deleted.' }
  }
  if (userId) kv.set(`journal:${userId}`, null)
  await useAuth.getState().signOut()
  return {}
}
