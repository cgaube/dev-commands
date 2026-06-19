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

export async function branchPr(branch: string): Promise<PrInfo | null> {
  try {
    const { stdout } = await execa('gh', [
      'pr',
      'view',
      branch,
      '--json',
      'number,state,title,url,isDraft,reviewDecision,statusCheckRollup',
    ])
    const data = JSON.parse(stdout)
    return {
      number: data.number,
      state: data.state,
      title: data.title,
      url: data.url,
      isDraft: data.isDraft,
      reviewDecision: data.reviewDecision || null,
      checksStatus: aggregateChecks(data.statusCheckRollup),
    }
  } catch {
    return null
  }
}
