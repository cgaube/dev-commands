import {
  commitCount,
  currentBranch,
  gitDir,
  isAncestor,
  isWorkingTreeDirty,
  refShas,
} from '#src/utils/git'
import { isRebaseInProgress, readStacks, type GhStack } from './ghStack'

export type StackBranch = {
  name: string
  // The first unmerged branch below this one, or the trunk.
  parent: string
  // The parent tip at the last sync or rebase, as gh-stack records it.
  base: string | null
  ahead: number
  exists: boolean
  isCurrent: boolean
  isDirty: boolean
  isMerged: boolean
  // True when the parent has commits that this branch does not contain.
  needsRebase: boolean
  // True when the local sha is different from the sha on origin.
  diverged: boolean
  prNumber: number | null
}

export type LocalStack = {
  // The stack number on GitHub. Null until the stack exists on GitHub.
  number: number | null
  trunk: string
  // Ordered from the bottom (closest to the trunk) to the top.
  branches: StackBranch[]
  isActive: boolean
}

export type StackState = {
  gitDir: string
  currentBranch: string
  stacks: LocalStack[]
  rebaseInProgress: boolean
}

async function buildStack(
  stack: GhStack,
  current: string,
  dirty: boolean,
  local: Map<string, string>,
  remote: Map<string, string>,
): Promise<LocalStack> {
  const trunk = stack.trunk.branch
  const branches = await Promise.all(
    stack.branches.map(async (ref, i): Promise<StackBranch> => {
      const name = ref.branch
      // A merged branch is no longer a real parent: gh stack rebases the
      // branches above it onto the next unmerged branch below, or the trunk.
      const below = stack.branches
        .slice(0, i)
        .filter((b) => !b.pullRequest?.merged)
      const parent = below.at(-1)?.branch ?? trunk
      const sha = local.get(name)
      const parentSha = local.get(parent)
      const isMerged = !!ref.pullRequest?.merged
      const exists = !!sha
      // Count from the parent when it exists locally. Otherwise count from
      // the recorded base.
      // The recorded base is the tip of the branch directly below. When that
      // branch is merged, the base is stale, so do not use it.
      const directParentMerged =
        i > 0 && !!stack.branches[i - 1].pullRequest?.merged
      const base = directParentMerged ? null : (ref.base ?? null)
      const countBase = parentSha ? parent : base
      const [ahead, containsParent] = await Promise.all([
        exists && countBase ? commitCount(countBase, name) : 0,
        exists && parentSha && !isMerged ? isAncestor(parent, name) : true,
      ])
      const remoteSha = remote.get(name)
      return {
        name,
        parent,
        base,
        ahead,
        exists,
        isCurrent: name === current,
        isDirty: name === current && dirty,
        isMerged,
        needsRebase: !containsParent,
        diverged: !!sha && !!remoteSha && sha !== remoteSha,
        prNumber: ref.pullRequest?.number ?? null,
      }
    }),
  )
  return {
    number: stack.number ?? null,
    trunk,
    branches,
    isActive: branches.some((b) => b.isCurrent),
  }
}

export async function loadStackState(): Promise<StackState> {
  const dir = await gitDir()
  const [stacks, current, dirty, local, rawRemote, rebaseInProgress] =
    await Promise.all([
      readStacks(dir),
      currentBranch(),
      isWorkingTreeDirty(),
      refShas('refs/heads'),
      refShas('refs/remotes/origin'),
      isRebaseInProgress(dir),
    ])
  const remote = new Map<string, string>()
  for (const [ref, sha] of rawRemote) {
    remote.set(ref.replace(/^origin\//, ''), sha)
  }
  const built = await Promise.all(
    stacks.map((s) => buildStack(s, current, dirty, local, remote)),
  )
  return {
    gitDir: dir,
    currentBranch: current,
    stacks: built.map(withoutDoneBranches),
    rebaseInProgress,
  }
}

// A merged branch that is deleted locally is done: you cannot check it out,
// and gh stack does not rebase onto it. Remove it from the view. When all the
// branches are done, keep them, so that a sync can remove the stack.
function withoutDoneBranches(stack: LocalStack): LocalStack {
  const open = stack.branches.filter((b) => b.exists || !b.isMerged)
  return open.length ? { ...stack, branches: open } : stack
}

// The stack label that the TUI and `log` show, e.g. "#12 · main".
export function stackLabel(stack: LocalStack): string {
  const id = stack.number ? `#${stack.number}` : 'local'
  return `${id} · ${stack.trunk}`
}
