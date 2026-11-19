import { supabase } from './supabase'

/**
 * Opens Stripe Checkout in the browser. The `billing` Edge Function holds the Stripe secret; on
 * success Stripe redirects to `nexday://billing/success`, which makes the app reload its plan.
 */
export async function startCheckout(): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Payments need your Nexday account.' }
  const { data, error } = await supabase.functions.invoke('billing', {
    body: { action: 'checkout' }
  })
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status
    if (status === 503) return { error: 'Payments are not set up yet.' }
    return { error: 'Could not start checkout. Try again in a moment.' }
  }
  const payload = data as { url?: string; error?: string } | null
  if (!payload?.url) {
    return {
      error:
        payload?.error === 'notConfigured'
          ? 'Payments are not set up yet.'
          : 'Could not start checkout.'
    }
  }
  if (window.api?.openExternal) await window.api.openExternal(payload.url)
  else window.open(payload.url, '_blank')
  return {}
}
