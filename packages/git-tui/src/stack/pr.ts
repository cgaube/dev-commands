import { execa } from 'execa'

export type ChecksStatus = 'success' | 'failure' | 'pending' | null

export type PrInfo = {
  number: number
  state: string
  title: string
  url: string
  isDraft: boolean
  reviewDecision: string | null
  checksStatus: ChecksStatus
}

function aggregateChecks(rollup: any[] | null | undefined): ChecksStatus {
  if (!rollup || rollup.length === 0) return null
  let hasPending = false
  for (const check of rollup) {
    const result = check.conclusion ?? check.state
    switch (result) {
      case 'FAILURE':
      case 'ERROR':
      case 'TIMED_OUT':
      case 'ACTION_REQUIRED':
        return 'failure'
      case 'SUCCESS':
      case 'NEUTRAL':
      case 'SKIPPED':
        break
      default:
        hasPending = true
    }
  }
  return hasPending ? 'pending' : 'success'
}

function toPrInfo(data: any): PrInfo {
  return {
    number: data.number,
    state: data.state,
    title: data.title,
    url: data.url,
    isDraft: data.isDraft,
    reviewDecision: data.reviewDecision || null,
    checksStatus: aggregateChecks(data.statusCheckRollup),
  }
}

const PR_FIELDS =
  'number,state,title,url,isDraft,reviewDecision,statusCheckRollup'

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
