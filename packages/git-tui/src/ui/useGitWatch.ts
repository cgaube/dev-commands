import { watch, type FSWatcher } from 'fs'
import { useEffect, useRef } from 'react'
import { GIT_REBASE_DIRS, STACK_REBASE_FILE } from '#src/data/git'

// Watch the directories, not the single files: git and gh stack replace
// files, and a watch on a replaced file stops. Only these names cause a
// reload, so that index writes do not.
const OWN_FILES = new Set([
  'HEAD',
  'gh-stack',
  STACK_REBASE_FILE,
  ...GIT_REBASE_DIRS,
])
const SHARED_FILES = new Set(['packed-refs'])
const SHARED_DIRS = ['refs/heads', 'refs/remotes']

const DEBOUNCE_MS = 300

// Call onChange when a branch, HEAD, the stacks or the rebase state change.
// In a linked worktree, HEAD and the stack file are in the worktree's git
// directory, and the branches are in the shared directory.
export function useGitWatch(
  gitDir: string | undefined,
  commonDir: string | undefined,
  onChange: () => void,
) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!gitDir || !commonDir) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const fire = () => {
      clearTimeout(timer)
      timer = setTimeout(() => onChangeRef.current(), DEBOUNCE_MS)
    }
    const watchers: FSWatcher[] = []
    const add = (path: string, filter?: Set<string>, recursive = false) => {
      try {
        watchers.push(
          watch(path, { recursive }, (_event, name) => {
            if (!filter || (name && filter.has(name))) fire()
          }),
        )
      } catch {
        // The path does not exist. R still reloads.
      }
    }
    for (const dir of SHARED_DIRS) add(`${commonDir}/${dir}`, undefined, true)
    if (gitDir === commonDir) {
      add(gitDir, new Set([...OWN_FILES, ...SHARED_FILES]))
    } else {
      add(gitDir, OWN_FILES)
      add(commonDir, SHARED_FILES)
    }
    return () => {
      clearTimeout(timer)
      for (const w of watchers) w.close()
    }
  }, [gitDir, commonDir])
}
