import { gitOutput } from '#src/utils/git'

export type BranchLog = {
  commits: string
  parent: string
  // The commit (oneline) that the branch sits on. Null if not known.
  base: string | null
  // For a trunk: true when it has commits older than these.
  hasOlder?: boolean
  error?: string
}

// The trunk shows its latest commits, as many as the pane has space for.
// This is more than any pane shows.
const TRUNK_LOG_COUNT = 100

// Get the commits of a branch. Use the recorded base when it is known, so
// that the log shows only the commits of this branch, also when the parent
// has moved. For the trunk, show the last commits.
export async function branchLog(
  branch: string,
  parent: string | null,
  recordedBase: string | null,
): Promise<BranchLog> {
  if (!parent) {
    // Read one more commit, to know if there are older ones.
    const lines = (
      await gitOutput(['log', '--oneline', `-${TRUNK_LOG_COUNT + 1}`, branch])
    )
      .split('\n')
      .filter(Boolean)
    return {
      commits: lines.slice(0, TRUNK_LOG_COUNT).join('\n'),
      parent: '',
      base: null,
      hasOlder: lines.length > TRUNK_LOG_COUNT,
    }
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
