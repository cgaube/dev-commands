import { execa } from 'execa'

export type ChecksStatus = 'success' | 'failure' | 'pending' | null

export type PrInfo = {
  number: number
  state: string
  title: string
  url: string
  isDraft: boolean
  reviewDecision: string | null
  mergeStateStatus: string | null
  checksStatus: ChecksStatus
  checks: ChecksSummary
}

export type PrStatus =
  | 'merged'
  | 'closed'
  | 'draft'
  | 'conflicts'
  | 'rework'
  | 'behind'
  | 'ready'
  | 'approved'
  | 'review'

// One word for where the PR is. GitHub sets mergeStateStatus to CLEAN when
// the PR can be merged now: reviews and required checks are done.
export function prStatus(pr: PrInfo): PrStatus {
  if (pr.state === 'MERGED') return 'merged'
  if (pr.state === 'CLOSED') return 'closed'
  if (pr.isDraft) return 'draft'
  if (pr.mergeStateStatus === 'DIRTY') return 'conflicts'
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'rework'
  // The base branch has new commits, and GitHub wants the PR updated first.
  if (pr.mergeStateStatus === 'BEHIND') return 'behind'
  if (pr.mergeStateStatus === 'CLEAN') return 'ready'
  if (pr.reviewDecision === 'APPROVED') return 'approved'
  return 'review'
}

// The checks of a PR by result. The names are the check names (or the status
// context) as GitHub shows them.
export type ChecksSummary = {
  total: number
  passed: number
  failing: string[]
  pending: string[]
}

function summarizeChecks(rollup: any[] | null | undefined): ChecksSummary {
  const summary: ChecksSummary = {
    total: 0,
    passed: 0,
    failing: [],
    pending: [],
  }
  for (const check of rollup ?? []) {
    const name = check.name || check.context || '?'
    summary.total++
    switch (check.conclusion || check.state) {
      case 'FAILURE':
      case 'ERROR':
      case 'TIMED_OUT':
      case 'ACTION_REQUIRED':
      case 'CANCELLED':
      case 'STARTUP_FAILURE':
        summary.failing.push(name)
        break
      case 'SUCCESS':
      case 'NEUTRAL':
      case 'SKIPPED':
        summary.passed++
        break
      default:
        summary.pending.push(name)
    }
  }
  return summary
}

function checksStatus(summary: ChecksSummary): ChecksStatus {
  if (summary.total === 0) return null
  if (summary.failing.length > 0) return 'failure'
  return summary.pending.length > 0 ? 'pending' : 'success'
}

function toPrInfo(data: any): PrInfo {
  const checks = summarizeChecks(data.statusCheckRollup)
  return {
    number: data.number,
    state: data.state,
    title: data.title,
    url: data.url,
    isDraft: data.isDraft,
    reviewDecision: data.reviewDecision || null,
    mergeStateStatus: data.mergeStateStatus || null,
    checksStatus: checksStatus(checks),
    checks,
  }
}

const PR_FIELDS =
  'number,state,title,url,isDraft,reviewDecision,mergeStateStatus,statusCheckRollup'

// How many recent PRs to read in one call. A branch with an older PR shows
// no PR.
const PR_LIST_LIMIT = 200

// Get the PRs of all the branches in one call, mapped by branch name. One
// `gh pr view` for each local branch is too slow when there are many. gh
// lists the newest PRs first, so a branch with more than one PR gets the
// newest one. PRs from forks can use the same branch names, so skip them.
export async function listPrs(): Promise<Map<string, PrInfo>> {
  const prs = new Map<string, PrInfo>()
  try {
    const { stdout } = await execa('gh', [
      'pr',
      'list',
      '--state',
      'all',
      '--limit',
      String(PR_LIST_LIMIT),
      '--json',
      `${PR_FIELDS},headRefName,isCrossRepository`,
    ])
    for (const data of JSON.parse(stdout)) {
      if (data.isCrossRepository || prs.has(data.headRefName)) continue
      prs.set(data.headRefName, toPrInfo(data))
    }
  } catch {
    // Without gh or a GitHub remote, show no PRs.
  }
  return prs
}
