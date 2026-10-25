import {
  branchMoveDates,
  changedFileCount,
  commitCount,
  currentBranch,
  defaultBranch,
  gitDirs,
  isGitRebaseInProgress,
  isAncestor,
  leftRightCount,
  refDates,
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
  // The files with changes that are not committed. Only the current branch
  // has them, so it is 0 for the other branches.
  changedFiles: number
  isMerged: boolean
  // True when the parent has commits that this branch does not contain.
  needsRebase: boolean
  // The commits that origin does not have yet, and the commits on origin
  // that the local branch does not have. 0 when there is no remote branch.
  unpushed: number
  unpulled: number
  // True when origin has a branch with the same name.
  hasRemote: boolean
  prNumber: number | null
  // The time of the last commit of the branch, in seconds since the epoch.
  // Without commits of its own, the time the branch was last moved, e.g.
  // created. See branchTime.
  committedAt: number | null
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

type BranchDates = {
  // The committer date of each branch tip.
  committed: Map<string, number>
  // The time git last moved each branch. See branchMoveDates.
  moved: Map<string, number>
}

// A branch without commits of its own points at a commit of its parent, so
// its commit date is the parent's: a new branch would look as old as its
// parent. Use the time git last moved the branch instead.
function branchTime(
  dates: BranchDates,
  name: string,
  ahead: number,
): number | null {
  if (ahead > 0) return dates.committed.get(name) ?? null
  return dates.moved.get(name) ?? dates.committed.get(name) ?? null
}

// Count the commits to push and to pull. Only ask git when the local and
// remote shas are different.
async function pushState(
  name: string,
  sha: string | undefined,
  remoteSha: string | undefined,
): Promise<[number, number]> {
  if (!sha || !remoteSha || sha === remoteSha) return [0, 0]
  return leftRightCount(name, `origin/${name}`)
}

async function buildStack(
  stack: GhStack,
  current: string,
  changedFiles: number,
  local: Map<string, string>,
  remote: Map<string, string>,
  dates: BranchDates,
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
      const remoteSha = remote.get(name)
      const [ahead, containsParent, [unpushed, unpulled]] = await Promise.all([
        exists && countBase ? commitCount(countBase, name) : 0,
        exists && parentSha && !isMerged ? isAncestor(parent, name) : true,
        pushState(name, sha, remoteSha),
      ])
      return {
        name,
        parent,
        base,
        ahead,
        exists,
        isCurrent: name === current,
        changedFiles: name === current ? changedFiles : 0,
        isMerged,
        needsRebase: !containsParent,
        unpushed,
        unpulled,
        hasRemote: !!remoteSha,
        prNumber: ref.pullRequest?.number ?? null,
        committedAt: branchTime(dates, name, ahead),
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
  changedFiles: number,
  local: Map<string, string>,
  remote: Map<string, string>,
  dates: BranchDates,
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
      const remoteSha = remote.get(name)
      const [ahead, containsParent, [unpushed, unpulled]] = await Promise.all([
        parentRef ? commitCount(parentRef, name) : 0,
        parentRef ? isAncestor(parentRef, name) : true,
        pushState(name, local.get(name), remoteSha),
      ])
      return {
        name,
        parent: trunk,
        base: null,
        ahead,
        exists: true,
        isCurrent: name === current,
        changedFiles: name === current ? changedFiles : 0,
        isMerged: false,
        needsRebase: !containsParent,
        unpushed,
        unpulled,
        hasRemote: !!remoteSha,
        prNumber: null,
        committedAt: branchTime(dates, name, ahead),
      }
    }),
  )
}

export async function loadStackState(): Promise<StackState> {
  const { gitDir: dir, commonDir } = await gitDirs()
  const [
    stacks,
    current,
    changedFiles,
    local,
    rawRemote,
    stackRebase,
    committed,
  ] = await Promise.all([
    readStacks(dir),
    currentBranch(),
    changedFileCount(),
    refShas('refs/heads'),
    refShas('refs/remotes/origin'),
    isRebaseInProgress(dir),
    refDates('refs/heads'),
  ])
  const remote = new Map<string, string>()
  for (const [ref, sha] of rawRemote) {
    remote.set(ref.replace(/^origin\//, ''), sha)
  }
  const [trunk, moved] = await Promise.all([
    defaultBranch(local),
    branchMoveDates(commonDir, [...local.keys()]),
  ])
  const dates = { committed, moved }
  const [built, branches] = await Promise.all([
    Promise.all(
      stacks.map((s) =>
        buildStack(s, current, changedFiles, local, remote, dates),
      ),
    ),
    buildPlainBranches(
      stacks,
      trunk,
      current,
      changedFiles,
      local,
      remote,
      dates,
    ),
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
