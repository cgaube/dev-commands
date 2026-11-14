import {
  keepPreviousData,
  QueryClient,
  queryOptions,
  skipToken,
} from '@tanstack/react-query'
import { branchCommits, changedFiles } from '#src/data/git'
import { listPrs, prCommits, type Pr } from '#src/data/github'
import { loadModel, type Model, type Row } from '#src/data/model'
import { readPrCache, writePrCache } from '#src/data/prCache'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // A terminal has no window focus or network events.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

// Each key is one data source, so that each one reloads at its own pace.
// - git: local data. It is fast, and the git watcher reloads it.
// - prs: GitHub data. It is slow, so it reloads on a timer.
// - commits, files: the details of the selected branch.
export const keys = {
  model: ['git', 'model'] as const,
  files: ['git', 'files'] as const,
  commits: (row: Row, sha: string | undefined) =>
    ['git', 'commits', row.name, row.parent, sha] as const,
  prs: ['prs'] as const,
}

export const modelQuery = queryOptions({
  queryKey: keys.model,
  queryFn: loadModel,
  // Only the git watcher and the actions make the data stale.
  staleTime: Infinity,
})

// Reload fast while a CI run is in progress, and slowly when not.
const PENDING_INTERVAL = 15_000
const IDLE_INTERVAL = 60_000

// The PRs of the branches in the list. The branch names are in the key, so
// a new branch reads its PR. Until the first read ends, show the PRs of the
// last run from the disk cache, and keep the previous data on a key change.
export const prsQuery = (model: Model | undefined) => {
  const branches = (model?.rows ?? [])
    .filter((r) => r.kind !== 'trunk')
    .map((r) => r.name)
    .toSorted()
  const commonDir = model?.repo.commonDir
  // Functions: TanStack Query calls them only when it makes the query, so
  // the file is not read at each render.
  const cache = () => (commonDir ? readPrCache(commonDir) : null)
  return queryOptions({
    queryKey: [...keys.prs, branches] as const,
    queryFn:
      commonDir && branches.length
        ? async () => {
            const prs = await listPrs(branches)
            await writePrCache(commonDir, prs)
            return prs
          }
        : skipToken,
    initialData: () => cache()?.data,
    initialDataUpdatedAt: () => cache()?.updatedAt,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    retry: false,
    refetchInterval: (query) => {
      const prs = query.state.data
      const pending = prs && Object.values(prs).some((p) => p.ci === 'pending')
      return pending ? PENDING_INTERVAL : IDLE_INTERVAL
    },
  })
}

export const commitsQuery = (row: Row | undefined, sha: string | undefined) =>
  queryOptions({
    queryKey: row ? keys.commits(row, sha) : ['git', 'commits', null],
    // The sha is in the key, so the cache stays valid until the branch moves.
    queryFn: row?.exists
      ? () => branchCommits(row.name, row.parent)
      : skipToken,
    staleTime: Infinity,
  })

// The commits of a PR. The commits of a merged PR do not change.
export const prCommitsQuery = (pr: Pr | undefined) =>
  queryOptions({
    queryKey: ['prs', 'commits', pr?.number ?? null] as const,
    queryFn: pr ? () => prCommits(pr.number) : skipToken,
    staleTime: pr?.status === 'merged' ? Infinity : 60_000,
  })

export const filesQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: keys.files,
    queryFn: enabled ? changedFiles : skipToken,
    staleTime: Infinity,
  })

export type PrMap = Record<string, Pr>
