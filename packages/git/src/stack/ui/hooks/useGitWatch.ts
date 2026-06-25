import { watch, type WatchOptions } from 'fs'
import { useEffect, useRef } from 'react'

const TARGETS: Array<[path: string, options?: WatchOptions]> = [
  ['refs/heads', { recursive: true }],
  ['refs/remotes', { recursive: true }],
  ['HEAD'],
  ['devstack.json'],
  ['index'],
]

export function useGitWatch(
  gitDir: string | null,
  onChanged: () => void,
  isBusy?: () => boolean,
  debounceMs = 300,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Keep the latest callback/predicate in refs so the effect re-subscribes only
  // when gitDir changes, not on every render that passes new identities.
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged
  const isBusyRef = useRef(isBusy)
  isBusyRef.current = isBusy

  useEffect(() => {
    if (!gitDir) return

    const fire = () => {
      // Ignore changes we caused ourselves: an in-flight operation reloads on
      // completion, so reacting here would just double the work and flicker.
      if (isBusyRef.current?.()) return
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
