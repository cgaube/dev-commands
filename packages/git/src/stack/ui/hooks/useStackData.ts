import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { flatten, type FlatNode } from '#src/stack/graph'
import { gitOutput } from '#src/utils/git'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { forestQueryOptions } from '../query/queries'
import { useGitWatch } from './useGitWatch'

export type StatusVariant = 'info' | 'success' | 'error'

export function useStackData() {
  const forestQuery = useQuery(forestQueryOptions())

  const nodes = useMemo<FlatNode[]>(
    () => (forestQuery.data ? flatten(forestQuery.data.root) : []),
    [forestQuery.data],
  )
  const trunk = forestQuery.data?.meta.trunk ?? 'main'

  const [selected, setSelected] = useState(0)
  const [status, setStatus] = useState('loading…')
  const [statusVariant, setStatusVariant] = useState<StatusVariant>('info')
  const [busy, setBusy] = useState(false)
  const [gitDir, setGitDir] = useState<string | null>(null)

  const busyRef = useRef(busy)
  busyRef.current = busy

  const hasLoadedOnce = useRef(false)
  const hasFocusedInitially = useRef(false)

  useEffect(() => {
    if (hasLoadedOnce.current) return
    if (forestQuery.isSuccess) {
      hasLoadedOnce.current = true
      setStatus('ready')
      setStatusVariant('success')
    } else if (forestQuery.isError) {
      hasLoadedOnce.current = true
      setStatus(String(forestQuery.error))
      setStatusVariant('error')
    }
  }, [forestQuery.isSuccess, forestQuery.isError, forestQuery.error])

  useEffect(() => {
    if (hasFocusedInitially.current || !nodes.length) return
    hasFocusedInitially.current = true
    const current = nodes.findIndex((n) => n.node.isCurrent)
    if (current >= 0) setSelected(current)
  }, [nodes])

  useEffect(() => {
    setSelected((s) => Math.max(0, Math.min(s, nodes.length - 1)))
  }, [nodes])

  const run = useCallback(async (label: string, fn: () => Promise<string>) => {
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
    await queryClient.refetchQueries({ queryKey: queryKeys.all })
    setBusy(false)
  }, [])

  useEffect(() => {
    gitOutput(['rev-parse', '--absolute-git-dir']).then((d) =>
      setGitDir(d.trim()),
    )
  }, [])

  const watchInvalidate = useCallback(() => {
    if (busyRef.current) return
    queryClient.invalidateQueries({ queryKey: queryKeys.all })
  }, [])

  useGitWatch(gitDir, watchInvalidate, () => busyRef.current)

  const syncing = forestQuery.isFetching && !busy
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
    run,
    busy,
    status,
    statusVariant,
    syncing,
  }
}
