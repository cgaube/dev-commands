import { watch, type FSWatcher } from 'fs'
import { useEffect, useRef } from 'react'

export function useGitWatch(
  gitDir: string | null,
  onChanged: () => void,
  debounceMs = 300,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!gitDir) return

    const fire = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(onChanged, debounceMs)
    }

    const watchers: FSWatcher[] = []
    try {
      watchers.push(watch(`${gitDir}/refs/heads`, { recursive: true }, fire))
    } catch {}
    try {
      watchers.push(watch(`${gitDir}/HEAD`, fire))
    } catch {}
    try {
      watchers.push(watch(`${gitDir}/devstack.json`, fire))
    } catch {}
    try {
      watchers.push(watch(`${gitDir}/index`, fire))
    } catch {}

    return () => {
      clearTimeout(timer.current)
      watchers.forEach((w) => w.close())
    }
  }, [gitDir, onChanged, debounceMs])
}
