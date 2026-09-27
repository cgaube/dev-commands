import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { stateQueryOptions } from '../query/queries'
import { rowKey, toRows, type Row } from '../rows'
import { useGitWatch } from './useGitWatch'

export type StatusVariant = 'info' | 'success' | 'error'

// A warning shows in the status bar until the first action.
export function useStackData(warning: string | null) {
  const stateQuery = useQuery(stateQueryOptions())
  const state = stateQuery.data

  const rows = useMemo<Row[]>(() => toRows(state), [state])

  const [selected, setSelected] = useState(0)
  const [status, setStatus] = useState(warning ?? 'loading…')
  const [statusVariant, setStatusVariant] = useState<StatusVariant>(
    warning ? 'error' : 'info',
  )
  const [busy, setBusy] = useState(false)

  const busyRef = useRef(busy)
  busyRef.current = busy

  const hasLoadedOnce = useRef(false)
  const hasFocusedInitially = useRef(false)

  useEffect(() => {
    if (hasLoadedOnce.current) return
    if (stateQuery.isSuccess) {
      hasLoadedOnce.current = true
      // Keep the warning visible. Otherwise show "ready".
      if (!warning) {
        setStatus('ready')
        setStatusVariant('success')
      }
    } else if (stateQuery.isError) {
      hasLoadedOnce.current = true
      setStatus(String(stateQuery.error))
      setStatusVariant('error')
    }
  }, [stateQuery.isSuccess, stateQuery.isError, stateQuery.error, warning])

  useEffect(() => {
    if (hasFocusedInitially.current || !rows.length) return
    hasFocusedInitially.current = true
    const current = rows.findIndex((r) => r.isCurrent && r.branch)
    const fallback = rows.findIndex((r) => r.isCurrent)
    if (current >= 0) setSelected(current)
    else if (fallback >= 0) setSelected(fallback)
  }, [rows])

  // Keep the same row selected when the rows change, e.g. after an add.
  // When the row is gone, keep the same position.
  const selectedKey = useRef<string | null>(null)
  useEffect(() => {
    setSelected((s) => {
      const key = selectedKey.current
      const same = key ? rows.findIndex((r) => rowKey(r) === key) : -1
      return same >= 0 ? same : Math.max(0, Math.min(s, rows.length - 1))
    })
  }, [rows])
  useEffect(() => {
    const row = rows[selected]
    if (row) selectedKey.current = rowKey(row)
  }, [rows, selected])

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

  const watchInvalidate = useCallback(() => {
    if (busyRef.current) return
    queryClient.invalidateQueries({ queryKey: queryKeys.all })
  }, [])

  useGitWatch(state?.gitDir ?? null, watchInvalidate, () => busyRef.current)

  return {
    state,
    rows,
    selected,
    setSelected,
    selectedRow: rows[selected] as Row | undefined,
    run,
    busy,
    status,
    statusVariant,
    syncing: stateQuery.isFetching && !busy,
  }
}
