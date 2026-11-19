// Nexday billing — creates a Stripe Checkout session for Nexday Pro.
//
// Deploy as Edge Function "billing" (Dashboard → Edge Functions → Create). Secrets:
//   STRIPE_SECRET_KEY      sk_live_… or sk_test_…
//   STRIPE_PRICE_ID        the recurring price for Nexday Pro ($6/month)
// Then add the Stripe webhook endpoint (functions/v1/stripe-webhook) with the same events:
//   checkout.session.completed, customer.subscription.created/updated/deleted
//
// Success and cancel return to the app through nexday://billing/success|cancel.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })

const page = (custom: string): Response =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>Nexday</title>
<style>body{font:15px -apple-system,system-ui;background:#F5F5F4;color:#1A1A1A;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
div{background:#fff;border:1px solid #EDEDEB;border-radius:16px;padding:32px 36px;text-align:center;max-width:380px}
a{display:inline-block;margin-top:18px;background:#1A1A1A;color:#fff;text-decoration:none;border-radius:10px;padding:10px 18px}</style>
<div><h2>${custom === 'success' ? 'Thank you' : 'Checkout closed'}</h2>
<p>${custom === 'success' ? 'Your Nexday Pro subscription is starting.' : 'Nothing was charged.'}</p>
<a href="nexday://billing/${custom}">Return to Nexday</a></div>
<script>setTimeout(function(){location.href='nexday://billing/${custom}'},600)</script>`,
    { headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' } }
  )

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Stripe sends the person back here; forward them to the app.
  if (req.method === 'GET') {
    const status = new URL(req.url).searchParams.get('status')
    return page(status === 'success' ? 'success' : 'cancel')
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const price = Deno.env.get('STRIPE_PRICE_ID')
  const auth = req.headers.get('Authorization') ?? ''
  if (!url || !anon || !service || !auth.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401)
  }
  if (!stripeKey || !price) return json({ error: 'notConfigured' }, 503)

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
    /* empty body is fine */
  }
  if (body.action !== 'checkout') return json({ error: 'action' }, 400)

  const svc = createClient(url, service, { auth: { persistSession: false } })
  const sub = await svc
    .from('subscriptions')
    .select('provider_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const form = new URLSearchParams()
  form.set('mode', 'subscription')
  form.set('line_items[0][price]', price)
  form.set('line_items[0][quantity]', '1')
  form.set('client_reference_id', user.id)
  form.set('metadata[user_id]', user.id)
  form.set('subscription_data[metadata][user_id]', user.id)
  form.set('allow_promotion_codes', 'true')
  form.set('success_url', `${url}/functions/v1/billing?status=success&session_id={CHECKOUT_SESSION_ID}`)
  form.set('cancel_url', `${url}/functions/v1/billing?status=cancel`)
  const customer = sub.data?.provider_customer_id
  if (typeof customer === 'string' && customer) form.set('customer', customer)
  else if (user.email) form.set('customer_email', user.email)

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form
  })
  if (!res.ok) {
    console.error('[billing] stripe', res.status, await res.text())
    return json({ error: 'stripe' }, 502)
  }
  const session = (await res.json()) as { url?: string }
  if (!session.url) return json({ error: 'stripe' }, 502)
  return json({ url: session.url })
})
