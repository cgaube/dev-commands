import { useCallback, useEffect, useRef, useState } from 'react'
import { buildForest, flatten, type FlatNode } from '#src/stack/graph'
import { gitOutput } from '#src/utils/git'
import { useGitWatch } from './useGitWatch'

// Owns the stack model and keeps it in sync with the repo: the flattened
// forest, the selected row, and the `run` loop every git operation goes
// through. `run` lives here (not with the actions) because it is fundamentally
// "do something, then reload the forest" — so it owns `busy`/`status` too, and
// the on-disk watcher reads `busyRef` to avoid reloading mid-operation.
export type StatusVariant = 'info' | 'success' | 'error'

export function useStackData() {
  const [nodes, setNodes] = useState<FlatNode[]>([])
  const [trunk, setTrunk] = useState('main')
  const [selected, setSelected] = useState(0)
  const [status, setStatus] = useState('loading…')
  const [statusVariant, setStatusVariant] = useState<StatusVariant>('info')
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [gitDir, setGitDir] = useState<string | null>(null)

  const busyRef = useRef(busy)
  busyRef.current = busy

  const reload = useCallback(async (focusCurrent = false) => {
    const { root, meta } = await buildForest()
    const flat = flatten(root)
    setTrunk(meta.trunk)
    setNodes(flat)
    setSelected((s) => {
      if (focusCurrent) {
        const current = flat.findIndex((n) => n.node.isCurrent)
        if (current >= 0) return current
      }
      return Math.max(0, Math.min(s, flat.length - 1))
    })
  }, [])

  const run = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      setBusy(true)
      setStatus(label)
      setStatusVariant('info')
      try {
        setStatus(await fn())
        setStatusVariant('success')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error))
        setStatusVariant('error')
      }
      await reload()
      setBusy(false)
    },
    [reload],
  )

  useEffect(() => {
    gitOutput(['rev-parse', '--absolute-git-dir']).then((d) =>
      setGitDir(d.trim()),
    )
    reload(true)
      .then(() => {
        setStatus('ready')
        setStatusVariant('success')
      })
      .catch((e) => {
        setStatus(String(e))
        setStatusVariant('error')
      })
  }, [reload])

  // Reload when the repo changes on disk, unless an operation is mid-flight —
  // it will reload itself when it finishes.
  const watchReload = useCallback(async () => {
    if (busyRef.current) return
    setSyncing(true)
    try {
      await reload()
    } catch {
      // Branch may have been deleted mid-reload — swallow and retry next tick.
    }
    setSyncing(false)
  }, [reload])

  useGitWatch(gitDir, watchReload)

  const selectedNode = nodes[selected]?.node
  const currentBranch = nodes.find(({ node }) => node.isCurrent)?.node.name
  const hasTrackedBranches = nodes.some(({ node }) => !node.isTrunk)

  return {
    nodes,
    trunk,
    selected,
    setSelected,
    selectedNode,
    currentBranch,
    hasTrackedBranches,
    reload,
    run,
    busy,
    status,
    statusVariant,
    syncing,
  }
}
