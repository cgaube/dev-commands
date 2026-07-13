import { queryOptions, skipToken } from '@tanstack/react-query'
import { buildForest } from '#src/stack/graph'
import { branchLog } from '#src/stack/log'
import { branchPr } from '#src/stack/pr'
import { queryKeys } from './keys'

export const forestQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.forest(),
    queryFn: () => buildForest(),
  })

export const logQueryOptions = (branch: string | undefined) =>
  queryOptions({
    queryKey: queryKeys.log(branch ?? ''),
    queryFn: branch ? () => branchLog(branch) : skipToken,
  })

export const prQueryOptions = (branch: string) =>
  queryOptions({
    queryKey: queryKeys.pr(branch),
    queryFn: () => branchPr(branch),
    retry: false,
  })
