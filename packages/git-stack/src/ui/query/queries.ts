import { queryOptions, skipToken } from '@tanstack/react-query'
import { loadStackState } from '#src/stack/model'
import { branchLog } from '#src/stack/log'
import { branchPr } from '#src/stack/pr'
import type { Row } from '../rows'
import { queryKeys } from './keys'

export const stateQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.state(),
    queryFn: () => loadStackState(),
  })

export const logQueryOptions = (row: Row | undefined) =>
  queryOptions({
    queryKey: queryKeys.log(row?.name ?? '', row?.branch?.base ?? null),
    queryFn: row
      ? () =>
          branchLog(
            row.name,
            row.branch?.parent ?? null,
            row.branch?.base ?? null,
          )
      : skipToken,
  })

export const prQueryOptions = (branch: string) =>
  queryOptions({
    queryKey: queryKeys.pr(branch),
    queryFn: () => branchPr(branch),
    retry: false,
  })
