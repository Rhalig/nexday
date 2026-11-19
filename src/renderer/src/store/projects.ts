import { create } from 'zustand'

export type CustomProject = { id?: string; slug: string; name: string; color: string }

type ProjectsState = {
  custom: CustomProject[]
  add: (name: string, color: string) => string
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'project'

export const useProjects = create<ProjectsState>((set, get) => ({
  custom: [],
  add: (name, color) => {
    let slug = slugify(name)
    const taken = new Set(['planner-mvp', 'moving-house', 'reading-list', ...get().custom.map((p) => p.slug)])
    let n = 2
    const base = slug
    while (taken.has(slug)) slug = `${base}-${n++}`
    set((s) => ({ custom: [...s.custom, { id: crypto.randomUUID(), slug, name, color }] }))
    return slug
  }
}))
