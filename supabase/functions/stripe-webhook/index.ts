// Stripe → Nexday. Verifies the signature and keeps public.subscriptions in step.
//
// Deploy as Edge Function "stripe-webhook". Secret: STRIPE_WEBHOOK_SECRET (from the endpoint you
// create in Stripe). Point Stripe at:
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed and customer.subscription.created/updated/deleted.

import { createClient } from 'npm:@supabase/supabase-js@2'

const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

const same = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verify(payload: string, header: string, secret: string): Promise<boolean> {
  let timestamp = ''
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.split('=')
    if (k === 't') timestamp = v
    else if (k === 'v1' && v) signatures.push(v)
  }
  if (!timestamp || !signatures.length) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  )
  const expected = hex(mac)
  return signatures.some((s) => same(s, expected))
}

type Row = Record<string, unknown>
const JSON_HEADER = { 'Content-Type': 'application/json' }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!url || !service || !secret) return new Response('notConfigured', { status: 503 })

  const payload = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''
  if (!(await verify(payload, signature, secret))) return new Response('signature', { status: 400 })

  let event: Row
  try {
    event = JSON.parse(payload) as Row
  } catch {
    return new Response('json', { status: 400 })
  }

  const svc = createClient(url, service, { auth: { persistSession: false } })
  const object = (event.data as Row | undefined)?.object as Row | undefined
  if (!object) return new Response(JSON.stringify({ received: true }), { headers: JSON_HEADER })
  const type = String(event.type ?? '')

  try {
    if (type === 'checkout.session.completed') {
      const userId = String(object.client_reference_id ?? (object.metadata as Row | undefined)?.user_id ?? '')
      if (userId) {
        await svc.from('subscriptions').upsert(
          {
            user_id: userId,
            plan_id: 'pro',
            status: 'active',
            provider: 'stripe',
            provider_customer_id: typeof object.customer === 'string' ? object.customer : null,
            provider_sub_id: typeof object.subscription === 'string' ? object.subscription : null,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        )
      }
    } else if (type.startsWith('customer.subscription.')) {
      let userId = String((object.metadata as Row | undefined)?.user_id ?? '')
      if (!userId) {
        const found = await svc
          .from('subscriptions')
          .select('user_id')
          .eq('provider_sub_id', String(object.id ?? ''))
          .maybeSingle()
        userId = String(found.data?.user_id ?? '')
      }
      const status = String(object.status ?? '')
      const active = ['active', 'trialing', 'past_due'].includes(status)
      if (userId) {
        await svc.from('subscriptions').upsert(
          {
            user_id: userId,
            plan_id: active ? 'pro' : 'free',
            status: status === 'trialing' ? 'trialing' : status === 'past_due' ? 'past_due' : active ? 'active' : 'canceled',
            provider: 'stripe',
            provider_customer_id: typeof object.customer === 'string' ? object.customer : null,
            provider_sub_id: String(object.id ?? ''),
            current_period_end:
              typeof object.current_period_end === 'number'
                ? new Date(object.current_period_end * 1000).toISOString()
                : null,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        )
      }
    }
  } catch (e) {
    console.error('[stripe-webhook]', e)
    return new Response('failed', { status: 500 })
  }
  return new Response(JSON.stringify({ received: true }), { headers: JSON_HEADER })
})
