// Nexday AI — a thin, private bridge to Gemini. The key never leaves this function.
//
// Deploy (Dashboard → Edge Functions → Create "ai", paste this file, Deploy), then add the secret
// GEMINI_API_KEY under Edge Functions → Secrets. Optional: GEMINI_MODEL (default gemini-2.5-flash).
//
// Actions (POST JSON):
//   { action: "parse",  text, today }                     → quick-capture classification
//   { action: "inbox",  title, meta, source, today }      → one inbox suggestion
//   { action: "note",   title, text, today }              → action items found in a note
//
// Every successful call increments public.ai_usage for the current month and is refused when the
// person's plan limit (plans.limits.ai_per_month) is reached.

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

type Row = Record<string, unknown>

const SYSTEM = `You are Nexday, a calm personal planning assistant.
Answer only with the JSON the schema asks for. Be short (titles under 80 characters).
Use the person's local date which is given as "today" (YYYY-MM-DD) and the weekday.
Projects: planner (Planner MVP / work), moving (Moving house), reading (Reading list), personal.
Never invent a date far in the future; "next week" means the Monday after today.`

const schema = {
  parse: {
    type: 'OBJECT',
    properties: {
      kind: { type: 'STRING', enum: ['task', 'event', 'note'] },
      title: { type: 'STRING' },
      project: { type: 'STRING', enum: ['planner', 'moving', 'reading', 'personal'] },
      date: { type: 'STRING', nullable: true },
      start: { type: 'STRING', nullable: true },
      end: { type: 'STRING', nullable: true },
      allDay: { type: 'BOOLEAN' },
      energy: { type: 'STRING', enum: ['Deep focus', 'Light'] },
      summary: { type: 'STRING' }
    },
    required: ['kind', 'title', 'project', 'allDay', 'energy']
  },
  inbox: {
    type: 'OBJECT',
    properties: {
      kind: { type: 'STRING', enum: ['task', 'event', 'note'] },
      when: { type: 'STRING', nullable: true },
      project: { type: 'STRING', enum: ['planner', 'moving', 'reading', 'personal'] },
      duration: { type: 'STRING', nullable: true },
      reason: { type: 'STRING' }
    },
    required: ['kind', 'project', 'reason']
  },
  note: {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            when: { type: 'STRING', nullable: true }
          },
          required: ['title']
        }
      }
    },
    required: ['items']
  }
} as const

const clip = (v: unknown, max: number): string => String(v ?? '').slice(0, max)

function promptFor(action: string, body: Row): string {
  const today = typeof body.today === 'string' ? body.today : new Date().toISOString().slice(0, 10)
  if (action === 'parse') {
    return `Today is ${today}. The person typed this into quick capture:\n"""${clip(body.text, 2000)}"""
Classify it. A timed meeting or appointment is an event; a thing to do is a task; an idea or note is a note.
If it is an event, fill date, start and end (HH:MM). If it is a task, fill date/start only when the words give them.`
  }
  if (action === 'inbox') {
    return `Today is ${today}. This item arrived from ${clip(body.source || 'capture', 40)}:
Title: ${clip(body.title, 300)}
Meta: ${clip(body.meta, 500)}
Suggest what it should become and when, in one short line of reasoning.`
  }
  return `Today is ${today}. Find the concrete action items hiding in this note (at most 6).
Title: ${clip(body.title, 300)}
Note: ${clip(body.text, 8000)}`
}

async function gemini(action: string, body: Row): Promise<Row> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('notConfigured')
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: promptFor(action, body) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700,
          responseMimeType: 'application/json',
          responseSchema: schema[action as keyof typeof schema]
        }
      })
    }
  )
  if (!res.ok) throw new Error(`gemini ${res.status}`)
  const payload = (await res.json()) as Row
  const candidates = payload.candidates as Array<Row> | undefined
  const parts = (candidates?.[0]?.content as Row | undefined)?.parts as Array<Row> | undefined
  const text = (parts?.map((p) => String(p.text ?? '')).join('') ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object') throw new Error('empty')
  return parsed as Row
}

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

  let body: Row
  try {
    body = (await req.json()) as Row
  } catch {
    return json({ error: 'body' }, 400)
  }
  const action = String(body.action ?? '')
  if (!['parse', 'inbox', 'note'].includes(action)) return json({ error: 'action' }, 400)

  const svc = createClient(url, service, { auth: { persistSession: false } })
  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`

  const [sub, usage, plan] = await Promise.all([
    svc.from('subscriptions').select('plan_id').eq('user_id', user.id).maybeSingle(),
    svc.from('ai_usage').select('calls').eq('user_id', user.id).eq('month', month).maybeSingle(),
    svc.from('plans').select('limits').eq('id', 'free').maybeSingle()
  ])
  let limits = (plan.data?.limits as Row | null) ?? {}
  if (sub.data?.plan_id && sub.data.plan_id !== 'free') {
    const pro = await svc.from('plans').select('limits').eq('id', sub.data.plan_id).maybeSingle()
    limits = (pro.data?.limits as Row | null) ?? limits
  }
  const rawLimit = limits.ai_per_month
  const limit = typeof rawLimit === 'number' ? rawLimit : null
  const used = Number(usage.data?.calls ?? 0)
  if (limit !== null && used >= limit) return json({ error: 'limit', used, limit }, 429)

  try {
    const result = await gemini(action, body)
    await svc
      .from('ai_usage')
      .upsert(
        { user_id: user.id, month, calls: used + 1 },
        { onConflict: 'user_id,month' }
      )
    return json({ data: result, used: used + 1, limit })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message === 'notConfigured') return json({ error: 'notConfigured' }, 503)
    console.error('[ai]', message)
    return json({ error: 'ai', detail: message }, 502)
  }
})
