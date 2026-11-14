import { gh } from './exec'

export type CheckState = 'passed' | 'failed' | 'pending' | 'skipped'

export type Check = {
  name: string
  state: CheckState
  url: string | null
}

export type CiStatus = 'passed' | 'failed' | 'pending' | 'none'

export type PrStatus =
  | 'merged'
  | 'closed'
  | 'draft'
  | 'conflicts'
  | 'changes'
  | 'behind'
  | 'ready'
  | 'approved'
  | 'review'

export type ReviewState = 'approved' | 'changes' | 'commented' | 'requested'

export type Review = { login: string; state: ReviewState }

export type Pr = {
  number: number
  title: string
  url: string
  status: PrStatus
  ci: CiStatus
  checks: Check[]
  // The fields below can be missing in a cache file of an older version.
  author?: string | null
  baseRef?: string
  createdAt?: string
  mergedAt?: string | null
  additions?: number
  deletions?: number
  changedFiles?: number
  comments?: number
  unresolvedThreads?: number
  // The last review of each reviewer, then the requested reviewers.
  reviews?: Review[]
}

function toReviews(data: any): Review[] {
  const reviews: Review[] = []
  for (const r of data.latestOpinionatedReviews?.nodes ?? []) {
    const login = r?.author?.login
    if (!login) continue
    const state: ReviewState =
      r.state === 'APPROVED'
        ? 'approved'
        : r.state === 'CHANGES_REQUESTED'
          ? 'changes'
          : 'commented'
    reviews.push({ login, state })
  }
  for (const r of data.reviewRequests?.nodes ?? []) {
    const who = r?.requestedReviewer
    const login = who?.login ?? who?.name
    if (login && !reviews.some((x) => x.login === login)) {
      reviews.push({ login, state: 'requested' })
    }
  }
  return reviews
}

// One word that tells where the PR is. GitHub sets mergeStateStatus to CLEAN
// when the PR can merge now.
function prStatus(data: any): PrStatus {
  if (data.state === 'MERGED') return 'merged'
  if (data.state === 'CLOSED') return 'closed'
  if (data.isDraft) return 'draft'
  if (data.mergeStateStatus === 'DIRTY') return 'conflicts'
  if (data.reviewDecision === 'CHANGES_REQUESTED') return 'changes'
  if (data.mergeStateStatus === 'BEHIND') return 'behind'
  if (data.mergeStateStatus === 'CLEAN') return 'ready'
  if (data.reviewDecision === 'APPROVED') return 'approved'
  return 'review'
}

// A check run has a conclusion when it is done. A status context has a state.
function checkState(result: string | undefined): CheckState {
  switch (result) {
    case 'SUCCESS':
      return 'passed'
    case 'NEUTRAL':
    case 'SKIPPED':
      return 'skipped'
    case 'FAILURE':
    case 'ERROR':
    case 'TIMED_OUT':
    case 'ACTION_REQUIRED':
    case 'STARTUP_FAILURE':
      return 'failed'
    default:
      return 'pending'
  }
}

function toChecks(rollup: any[] | null | undefined): Check[] {
  return (
    (rollup ?? [])
      // Skip the nodes of other types: they have no name.
      .filter((c) => c && (c.name || c.context))
      // A newer run often cancels an older run. Ignore the cancelled run.
      .filter((c) => (c.conclusion || c.state) !== 'CANCELLED')
      .map((c) => ({
        name: c.name || c.context || '?',
        // A check run that is not done has no conclusion yet.
        state: checkState(c.conclusion || c.state),
        url: c.detailsUrl || c.targetUrl || null,
      }))
  )
}

function ciStatus(checks: Check[]): CiStatus {
  if (checks.length === 0) return 'none'
  if (checks.some((c) => c.state === 'failed')) return 'failed'
  if (checks.some((c) => c.state === 'pending')) return 'pending'
  return 'passed'
}

// The fields of a PR. statusCheckRollup is on the last commit. A check run
// has a name and a conclusion. A status context has a context and a state.
const PR_FIELDS = `
  number title url state isDraft reviewDecision mergeStateStatus
  isCrossRepository baseRefName createdAt mergedAt
  additions deletions changedFiles
  author { login }
  comments { totalCount }
  reviewThreads(first: 100) { nodes { isResolved } }
  latestOpinionatedReviews(first: 20) { nodes { state author { login } } }
  reviewRequests(first: 20) { nodes { requestedReviewer {
    ... on User { login }
    ... on Team { name }
  } } }
  commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) {
    nodes {
      ... on CheckRun { name conclusion status detailsUrl }
      ... on StatusContext { context state targetUrl }
    }
  } } } } }
`

// Ask for this number of branches in one GraphQL call. Larger calls are
// slow, so a repository with many branches makes calls in parallel.
const CHUNK = 25

// Get the PR of each branch from GitHub: one alias for each branch in one
// GraphQL query. This is much faster than `gh pr list`, which reads the PRs
// of all the people. A branch with more than one PR gets the newest one.
// Forks can use the same branch names, so skip their PRs.
async function prsOf(branches: string[]): Promise<Record<string, Pr>> {
  const aliases = branches.map(
    (name, i) =>
      `b${i}: pullRequests(headRefName: ${JSON.stringify(name)}, first: 3, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { ${PR_FIELDS} } }`,
  )
  const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${aliases.join('\n')} } }`
  // gh replaces {owner} and {repo} with the repository of the current
  // directory.
  const out = await gh([
    'api',
    'graphql',
    '-F',
    'owner={owner}',
    '-F',
    'name={repo}',
    '-f',
    `query=${query}`,
  ])
  const repository = JSON.parse(out).data?.repository ?? {}
  const prs: Record<string, Pr> = {}
  branches.forEach((name, i) => {
    const data = repository[`b${i}`]?.nodes?.find(
      (n: any) => !n.isCrossRepository,
    )
    if (!data) return
    const rollup = data.commits?.nodes?.[0]?.commit?.statusCheckRollup
    const checks = toChecks(rollup?.contexts?.nodes)
    prs[name] = {
      number: data.number,
      title: data.title,
      url: data.url,
      status: prStatus(data),
      ci: ciStatus(checks),
      checks,
      author: data.author?.login ?? null,
      baseRef: data.baseRefName,
      createdAt: data.createdAt,
      mergedAt: data.mergedAt ?? null,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changedFiles,
      comments: data.comments?.totalCount ?? 0,
      unresolvedThreads: (data.reviewThreads?.nodes ?? []).filter(
        (t: any) => t && !t.isResolved,
      ).length,
      reviews: toReviews(data),
    }
  })
  return prs
}

export async function listPrs(branches: string[]): Promise<Record<string, Pr>> {
  const chunks: string[][] = []
  for (let i = 0; i < branches.length; i += CHUNK) {
    chunks.push(branches.slice(i, i + CHUNK))
  }
  const results = await Promise.all(chunks.map(prsOf))
  return Object.assign({}, ...results)
}

// The commits of a PR, newest first, from GitHub. For a merged branch that
// no longer exists locally, git cannot show them.
export async function prCommits(
  number: number,
): Promise<import('./git').Commit[]> {
  const out = await gh(['pr', 'view', String(number), '--json', 'commits'])
  const commits = (JSON.parse(out).commits ?? []) as Array<{
    oid: string
    messageHeadline: string
    committedDate: string
  }>
  return commits
    .map((c) => ({
      sha: c.oid.slice(0, 8),
      subject: c.messageHeadline,
      committedAt: Math.floor(Date.parse(c.committedDate) / 1000),
    }))
    .toReversed()
}
