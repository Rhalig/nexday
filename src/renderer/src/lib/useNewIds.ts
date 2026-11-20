import { useEffect, useRef, useState } from 'react'

/**
 * Ids that showed up in a list a moment ago (something was just added), for about a second.
 * The first render and big loads (sign-in, a refresh) do not count: only a person adding one or two things.
 */
export function useNewIds(ids: string[]): Set<string> {
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const key = ids.join('|')
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(ids)
      return
    }
    const added = ids.filter((id) => !seen.current!.has(id))
    ids.forEach((id) => seen.current!.add(id))
    if (!added.length || added.length > 3 || seen.current.size === added.length) return
    setFresh((f) => new Set([...f, ...added]))
    setTimeout(() => {
      setFresh((f) => {
        const next = new Set(f)
        added.forEach((id) => next.delete(id))
        return next
      })
    }, 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return fresh
}
