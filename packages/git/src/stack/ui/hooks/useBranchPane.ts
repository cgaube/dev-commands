import { useEffect, useState } from 'react'

// Fetch async data for a branch pane (diff, log, …) when its tab is active.
// Clears to null when disabled or when no branch is selected, and cancels any
// in-flight fetch on change so a stale result can't land on the wrong branch.
export function useBranchPane<T>(
  enabled: boolean,
  name: string | undefined,
  fetcher: (name: string) => Promise<T>,
): T | null {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    if (!enabled || !name) {
      setData(null)
      return
    }
    let cancelled = false
    fetcher(name).then((d) => {
      if (!cancelled) setData(d)
    })
    return () => {
      cancelled = true
    }
    // fetcher is assumed stable (a module-level function).
  }, [enabled, name])

  return data
}
