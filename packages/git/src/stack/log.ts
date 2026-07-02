import { gitOutput, resolveSha } from '#src/utils/git'
import { readMeta, type StackMeta } from './model'

export type BranchLog = {
  commits: string
  parent: string
  // The parentSha commit (oneline) — the actual base the branch sits on.
  // Null if the ref can't be resolved.
  base: string | null
  // True when the parent branch tip has moved from the recorded parentSha,
  // meaning the branch needs a restack to pick up new parent commits.
  parentMoved: boolean
  // Set when a ref can't be resolved — signals the UI to suggest a sync.
  error?: string
}

const TRUNK_LOG_COUNT = 5

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
    return { commits, parent: '', base: null, parentMoved: false }
  }

  const info = data.branches[branch]
  const parent = info ? info.parent : data.trunk
  // Use the recorded parentSha as the log base so we always show exactly
  // this branch's commits, even when the parent has moved.
  const rangeBase = info?.parentSha ?? parent

  let commits: string
  try {
    commits = await gitOutput(['log', '--oneline', `${rangeBase}..${branch}`])
  } catch {
    const missing = info ? `parent "${parent}"` : `branch "${branch}"`
    return {
      commits: '',
      parent,
      base: null,
      parentMoved: false,
      error: `${missing} no longer exists`,
    }
  }

  let base: string | null
  try {
    base =
      (await gitOutput(['log', '--oneline', '-1', rangeBase])).trim() || null
  } catch {
    base = null
  }

  let parentMoved = false
  if (info?.parentSha) {
    const currentParentSha = await resolveSha(parent)
    parentMoved = !!currentParentSha && currentParentSha !== info.parentSha
  }

  return { commits, parent, base, parentMoved }
}
