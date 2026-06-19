import { watch, type WatchOptions } from 'fs'
import { useEffect, useRef } from 'react'

const TARGETS: Array<[path: string, options?: WatchOptions]> = [
  ['refs/heads', { recursive: true }],
  ['HEAD'],
  ['devstack.json'],
  ['index'],
]

export function useGitWatch(
  gitDir: string | null,
  onChanged: () => void,
  debounceMs = 300,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Keep the latest callback in a ref so the effect re-subscribes only when
  // gitDir changes, not on every render that passes a new onChanged identity.
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  useEffect(() => {
    if (!gitDir) return

    const fire = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => onChangedRef.current(), debounceMs)
    }

    const watchers = TARGETS.flatMap(([path, options]) => {
      try {
        return [watch(`${gitDir}/${path}`, options ?? {}, fire)]
      } catch {
        return [] // path absent (no index/devstack yet) — skip, keep the rest
      }
    })

    return () => {
      clearTimeout(timer.current)
      watchers.forEach((w) => w.close())
    }
  }, [gitDir, debounceMs])
}
