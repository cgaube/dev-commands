import { gitOutput } from '#src/utils/git'

export type BranchLog = {
  commits: string
  parent: string
  // The commit (oneline) that the branch sits on. Null if not known.
  base: string | null
  error?: string
}

const TRUNK_LOG_COUNT = 5

// Get the commits of a branch. Use the recorded base when it is known, so
// that the log shows only the commits of this branch, also when the parent
// has moved. For the trunk, show the last commits.
export async function branchLog(
  branch: string,
  parent: string | null,
  recordedBase: string | null,
): Promise<BranchLog> {
  if (!parent) {
    const commits = await gitOutput([
      'log',
      '--oneline',
      `-${TRUNK_LOG_COUNT}`,
      branch,
    ])
    return { commits, parent: '', base: null }
  }

  const rangeBase = recordedBase ?? parent
  let commits: string
  try {
    commits = await gitOutput(['log', '--oneline', `${rangeBase}..${branch}`])
  } catch {
    return {
      commits: '',
      parent,
      base: null,
      error: `branch "${branch}" or its base no longer exists`,
    }
  }

  let base: string | null
  try {
    base =
      (await gitOutput(['log', '--oneline', '-1', rangeBase])).trim() || null
  } catch {
    base = null
  }

  return { commits, parent, base }
}
