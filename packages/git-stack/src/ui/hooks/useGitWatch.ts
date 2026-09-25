import { watch, type WatchOptions } from 'fs'
import { useEffect, useRef } from 'react'
import { REBASE_STATE_FILE, STACK_FILE } from '#src/stack/ghStack'

// Watch the git directory itself, not the single files. gh-stack can replace
// its file, and a watch on a replaced file stops. Only these names cause a
// reload, so that index writes do not.
const ROOT_FILES = new Set(['HEAD', STACK_FILE, REBASE_STATE_FILE])

const TARGETS: Array<[path: string, options?: WatchOptions]> = [
  ['refs/heads', { recursive: true }],
  ['refs/remotes', { recursive: true }],
]

export function useGitWatch(
  gitDir: string | null,
  onChanged: () => void,
  isBusy?: () => boolean,
  debounceMs = 300,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Keep the latest callbacks in refs, so that the effect subscribes again
  // only when gitDir changes.
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged
  const isBusyRef = useRef(isBusy)
  isBusyRef.current = isBusy

  useEffect(() => {
    if (!gitDir) return

    const fire = () => {
      // An operation in progress reloads when it completes, so ignore the
      // changes that it causes.
      if (isBusyRef.current?.()) return
      clearTimeout(timer.current)
      timer.current = setTimeout(() => onChangedRef.current(), debounceMs)
    }

    const watchers = TARGETS.flatMap(([path, options]) => {
      try {
        return [watch(`${gitDir}/${path}`, options ?? {}, fire)]
      } catch {
        return [] // The path does not exist. Skip it and keep the others.
      }
    })
    try {
      watchers.push(
        watch(gitDir, (_event, name) => {
          if (name && ROOT_FILES.has(name)) fire()
        }),
      )
    } catch {
      // Without this watcher, R still reloads the view.
    }

    return () => {
      clearTimeout(timer.current)
      watchers.forEach((w) => w.close())
    }
  }, [gitDir, debounceMs])
}
