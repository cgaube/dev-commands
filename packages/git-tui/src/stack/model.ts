import {
  commitCount,
  currentBranch,
  defaultBranch,
  gitDirs,
  isGitRebaseInProgress,
  isAncestor,
  isWorkingTreeDirty,
  refShas,
} from '#src/utils/git'
import { isRebaseInProgress, readStacks, type GhStack } from './ghStack'

// A local branch. A stack branch comes from `.git/gh-stack`. A plain branch
// is any other local branch: its parent is always the default branch, and it
// has no recorded base, merge state or stack PR.
export type Branch = {
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
  // True when origin has a branch with the same name.
  hasRemote: boolean
  prNumber: number | null
}

export type LocalStack = {
  // The stack number on GitHub. Null until the stack exists on GitHub.
  number: number | null
  trunk: string
  // Ordered from the bottom (closest to the trunk) to the top.
  branches: Branch[]
  isActive: boolean
}

export type RebaseKind = 'stack' | 'git'

export type StackState = {
  gitDir: string
  // The git directory that all worktrees share. See gitDirs.
  commonDir: string
  currentBranch: string
  defaultBranch: string
  stacks: LocalStack[]
  // The local branches that are not in a stack and are not a trunk.
  branches: Branch[]
  // The rebase that stopped on a conflict: a gh stack rebase of a stack, a
  // plain git rebase of a plain branch, or none. gh stack rebase also uses
  // git rebase, so its state comes first.
  rebase: RebaseKind | null
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
    stack.branches.map(async (ref, i): Promise<Branch> => {
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
        hasRemote: !!remoteSha,
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

// Build the plain branches: all local branches that no stack uses. Compare
// them with the default branch, or with origin's copy when it does not exist
// locally.
async function buildPlainBranches(
  stacks: GhStack[],
  trunk: string,
  current: string,
  dirty: boolean,
  local: Map<string, string>,
  remote: Map<string, string>,
): Promise<Branch[]> {
  const used = new Set([trunk])
  for (const stack of stacks) {
    used.add(stack.trunk.branch)
    for (const ref of stack.branches) used.add(ref.branch)
  }
  const parentRef = local.has(trunk)
    ? trunk
    : remote.has(trunk)
      ? `origin/${trunk}`
      : null
  const names = [...local.keys()]
    .filter((name) => !used.has(name))
    .toSorted((a, b) => a.localeCompare(b))
  return Promise.all(
    names.map(async (name): Promise<Branch> => {
      const [ahead, containsParent] = await Promise.all([
        parentRef ? commitCount(parentRef, name) : 0,
        parentRef ? isAncestor(parentRef, name) : true,
      ])
      const remoteSha = remote.get(name)
      return {
        name,
        parent: trunk,
        base: null,
        ahead,
        exists: true,
        isCurrent: name === current,
        isDirty: name === current && dirty,
        isMerged: false,
        needsRebase: !containsParent,
        diverged: !!remoteSha && local.get(name) !== remoteSha,
        hasRemote: !!remoteSha,
        prNumber: null,
      }
    }),
  )
}

export async function loadStackState(): Promise<StackState> {
  const { gitDir: dir, commonDir } = await gitDirs()
  const [stacks, current, dirty, local, rawRemote, stackRebase] =
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
  const trunk = await defaultBranch(local)
  const [built, branches] = await Promise.all([
    Promise.all(
      stacks.map((s) => buildStack(s, current, dirty, local, remote)),
    ),
    buildPlainBranches(stacks, trunk, current, dirty, local, remote),
  ])
  return {
    gitDir: dir,
    commonDir,
    currentBranch: current,
    defaultBranch: trunk,
    stacks: built,
    branches,
    rebase: stackRebase ? 'stack' : isGitRebaseInProgress(dir) ? 'git' : null,
  }
}

// The stack label that the TUI and `log` show, e.g. "#12 · main".
export function stackLabel(stack: LocalStack): string {
  const id = stack.number ? `#${stack.number}` : 'local'
  return `${id} · ${stack.trunk}`
}
