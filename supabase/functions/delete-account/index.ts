// Nexday delete-account — permanently removes the signed-in person and everything they own.
//
// Deploy as Edge Function "delete-account" (Dashboard → Edge Functions → Create). Leave
// "Verify JWT" ON: the caller must be signed in. No extra secrets are needed
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase).
// Optional, only when Stripe billing is set up: STRIPE_SECRET_KEY, so an active Pro subscription
// is cancelled first (the account is NOT deleted if that cancellation fails, so nobody keeps
// being charged for an account that no longer exists).
//
// Every table references auth.users with ON DELETE CASCADE, so deleting the auth user removes
// tasks, notes, habits, events, projects, settings, usage and the subscription row.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const auth = req.headers.get('Authorization') ?? ''
  if (!url || !anon || !service || !auth.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401)
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false }
  })
  const {
    data: { user }
  } = await userClient.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    /* handled below */
  }
  if (body.action !== 'delete') return json({ error: 'action' }, 400)

  const svc = createClient(url, service, { auth: { persistSession: false } })

  // 1. Stop billing first.
  const sub = await svc
    .from('subscriptions')
    .select('provider, provider_sub_id, status')
    .eq('user_id', user.id)
    .maybeSingle()
  const subId = sub.data?.provider === 'stripe' ? sub.data.provider_sub_id : null
  if (typeof subId === 'string' && subId && sub.data?.status !== 'canceled') {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return json({ error: 'billingNotConfigured' }, 503)
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stripeKey}` }
    })
    // 404 means Stripe no longer knows it: nothing left to cancel.
    if (!res.ok && res.status !== 404) {
      console.error('[delete-account] stripe', res.status, await res.text())
      return json({ error: 'billing' }, 502)
    }
  }

  // 2. Delete the person; the database cascades everything else.
  const del = await svc.auth.admin.deleteUser(user.id)
  if (del.error) {
    console.error('[delete-account] delete', del.error.message)
    return json({ error: 'delete' }, 500)
  }
  return json({ ok: true })
})
