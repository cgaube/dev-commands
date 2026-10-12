import { watch, type WatchOptions } from 'fs'
import { useEffect, useRef } from 'react'
import { REBASE_STATE_FILE, STACK_FILE } from '#src/stack/ghStack'

// Watch the git directories themselves, not the single files. gh-stack can
// replace its file, and a watch on a replaced file stops. Only these names
// cause a reload, so that index writes do not.
// The git directory of this worktree has HEAD and the gh-stack files.
const OWN_FILES = ['HEAD', STACK_FILE, REBASE_STATE_FILE]
// The shared directory has the branches. In a linked worktree, it is not
// the git directory.
const SHARED_FILES = ['packed-refs']

const SHARED_TARGETS: Array<[path: string, options?: WatchOptions]> = [
  ['refs/heads', { recursive: true }],
  ['refs/remotes', { recursive: true }],
]

export function useGitWatch(
  gitDir: string | null,
  commonDir: string | null,
  onChanged: () => void,
  isBusy?: () => boolean,
  debounceMs = 300,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Keep the latest callbacks in refs, so that the effect subscribes again
  // only when a directory changes.
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged
  const isBusyRef = useRef(isBusy)
  isBusyRef.current = isBusy

  useEffect(() => {
    if (!gitDir || !commonDir) return

    const fire = () => {
      // An operation in progress reloads when it completes, so ignore the
      // changes that it causes.
      if (isBusyRef.current?.()) return
      clearTimeout(timer.current)
      timer.current = setTimeout(() => onChangedRef.current(), debounceMs)
    }

    const watchers = SHARED_TARGETS.flatMap(([path, options]) => {
      try {
        return [watch(`${commonDir}/${path}`, options ?? {}, fire)]
      } catch {
        return [] // The path does not exist. Skip it and keep the others.
      }
    })
    // In the main worktree, both sets of files are in the same directory.
    const roots = new Map<string, Set<string>>()
    for (const [dir, files] of [
      [gitDir, OWN_FILES],
      [commonDir, SHARED_FILES],
    ] as const) {
      roots.set(dir, new Set([...(roots.get(dir) ?? []), ...files]))
    }
    for (const [dir, files] of roots) {
      try {
        watchers.push(
          watch(dir, (_event, name) => {
            if (name && files.has(name)) fire()
          }),
        )
      } catch {
        // Without this watcher, R still reloads the view.
      }
    }

    return () => {
      clearTimeout(timer.current)
      watchers.forEach((w) => w.close())
    }
  }, [gitDir, commonDir, debounceMs])
}
