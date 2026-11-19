import { create } from 'zustand'
import { supabase } from './supabase'

/**
 * The person's plan and limits. Supabase reads `subscriptions` (own row) and `plans` (public).
 * A limit set to null/absent means unlimited (Pro).
 */
export type Limits = {
  projects?: number | null
  notes?: number | null
  calendars?: number | null
  ai_per_month?: number | null
}

const FREE_LIMITS: Limits = { projects: 5, notes: 50, calendars: 1, ai_per_month: 200 }

type PlanState = {
  id: string
  status: string
  limits: Limits
  aiUsed: number
  ready: boolean
  load: () => Promise<void>
  reset: () => void
}

const monthKey = (): string => {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export const usePlan = create<PlanState>((set) => ({
  id: 'free',
  status: 'active',
  limits: FREE_LIMITS,
  aiUsed: 0,
  ready: false,
  load: async () => {
    const sb = supabase
    if (!sb) {
      set({ ready: true })
      return
    }
    const {
      data: { user }
    } = await sb.auth.getUser()
    if (!user) return
    const [sub, plans, usage] = await Promise.all([
      sb.from('subscriptions').select('plan_id,status').eq('user_id', user.id).maybeSingle(),
      sb.from('plans').select('id,limits'),
      sb
        .from('ai_usage')
        .select('calls')
        .eq('user_id', user.id)
        .eq('month', monthKey())
        .maybeSingle()
    ])
    const id = String(sub.data?.plan_id ?? 'free')
    const row = (plans.data ?? []).find((p) => String(p.id) === id)
    const limits = (row?.limits as Limits | null) ?? {}
    set({
      id,
      status: String(sub.data?.status ?? 'active'),
      limits: id === 'free' ? { ...FREE_LIMITS, ...limits } : limits,
      aiUsed: Number(usage.data?.calls ?? 0),
      ready: true
    })
  },
  reset: () => set({ id: 'free', status: 'active', limits: FREE_LIMITS, aiUsed: 0, ready: false })
}))

/** `null` means unlimited. */
export const limitFor = (kind: keyof Limits): number | null => {
  const v = usePlan.getState().limits[kind]
  return typeof v === 'number' ? v : null
}

/** True while the person is still inside their plan for this resource. */
export const withinLimit = (kind: keyof Limits, used: number): boolean => {
  const limit = limitFor(kind)
  return limit === null || used < limit
}
