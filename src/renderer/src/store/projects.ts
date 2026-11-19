import { create } from 'zustand'

export type CustomProject = {
  id?: string
  slug: string
  name: string
  color: string
  description?: string
  /** Due date, YYYY-MM-DD */
  due?: string | null
}

type ProjectsState = {
  custom: CustomProject[]
  add: (name: string, color: string, extra?: { description?: string; due?: string | null }) => string
  update: (slug: string, patch: Partial<Pick<CustomProject, 'name' | 'color' | 'description' | 'due'>>) => void
  remove: (slug: string) => void
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'project'

export const useProjects = create<ProjectsState>((set, get) => ({
  custom: [],
  add: (name, color, extra) => {
    let slug = slugify(name)
    // Built-in keys and slugs are taken too (a project called "personal" would clash with the built-in one).
    const taken = new Set([
      'planner', 'moving', 'reading', 'personal',
      'planner-mvp', 'moving-house', 'reading-list',
      ...get().custom.map((p) => p.slug)
    ])
    let n = 2
    const base = slug
    while (taken.has(slug)) slug = `${base}-${n++}`
    set((s) => ({
      custom: [
        ...s.custom,
        { id: crypto.randomUUID(), slug, name, color, description: extra?.description ?? '', due: extra?.due ?? null }
      ]
    }))
    return slug
  },
  update: (slug, patch) =>
    set((s) => ({ custom: s.custom.map((p) => (p.slug === slug ? { ...p, ...patch } : p)) })),
  remove: (slug) => set((s) => ({ custom: s.custom.filter((p) => p.slug !== slug) }))
}))
