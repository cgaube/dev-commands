import { gitOutput } from '#src/utils/git'
import { readMeta, type StackMeta } from './model'

export type BranchLog = {
  // `git log --oneline parent..branch`: the commits the branch adds.
  commits: string
  parent: string
  // The parent's last commit (oneline) — the base the branch sits on, shown
  // dimmed for context. Null if the parent ref can't be resolved.
  base: string | null
  // Set when a ref can't be resolved — signals the UI to suggest a sync.
  error?: string
}

// Trunk has no parent, so we just show its recent history.
const TRUNK_LOG_COUNT = 5

// The commits a branch adds on top of its parent, plus the parent's tip commit
// for context — the commit-level counterpart to `branchDiff`. Trunk has no
// parent, so we show its last few commits instead.
export async function branchLog(
  branch: string,
  meta?: StackMeta,
): Promise<BranchLog> {
  const data = meta ?? (await readMeta())

  if (branch === data.trunk) {
    const commits = await gitOutput([
      'log',
      '--oneline',
      `-${TRUNK_LOG_COUNT}`,
      branch,
    ])
    return { commits, parent: '', base: null }
  }

  const info = data.branches[branch]
  const parent = info ? info.parent : data.trunk

  let commits: string
  try {
    commits = await gitOutput(['log', '--oneline', `${parent}..${branch}`])
  } catch {
    const missing = info ? `parent "${parent}"` : `branch "${branch}"`
    return {
      commits: '',
      parent,
      base: null,
      error: `${missing} no longer exists`,
    }
  }

  let base: string | null
  try {
    base = (await gitOutput(['log', '--oneline', '-1', parent])).trim() || null
  } catch {
    base = null
  }

  return { commits, parent, base }
}
