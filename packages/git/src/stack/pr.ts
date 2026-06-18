import { execa } from 'execa'

export type PrInfo = {
  number: number
  state: string
  title: string
  url: string
  isDraft: boolean
}

// Look up the GitHub PR associated with a branch via the `gh` CLI. Best-effort:
// returns null when there is no PR, or when `gh` is missing/unauthenticated, so
// the UI degrades gracefully instead of erroring. This is a network call, so
// callers should cache the result per branch.
export async function branchPr(branch: string): Promise<PrInfo | null> {
  try {
    const { stdout } = await execa('gh', [
      'pr',
      'view',
      branch,
      '--json',
      'number,state,title,url,isDraft',
    ])
    const data = JSON.parse(stdout)
    return {
      number: data.number,
      state: data.state,
      title: data.title,
      url: data.url,
      isDraft: data.isDraft,
    }
  } catch {
    return null
  }
}
