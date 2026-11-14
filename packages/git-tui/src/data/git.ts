import { existsSync } from 'fs'
import { git, gitOrNull } from './exec'

// The data of one local branch that one `git for-each-ref` call gives.
export type LocalBranch = {
  name: string
  sha: string
  // The upstream branch, for example `origin/feat`. Null when there is none.
  upstream: string | null
  // True when the upstream was set but the remote branch was deleted.
  upstreamGone: boolean
  // The commits to push and the commits to pull.
  unpushed: number
  unpulled: number
  // The commits that are not on the default branch, and the commits of the
  // default branch that this branch does not have.
  aheadOfMain: number
  behindMain: number
  // The time of the last commit, in seconds since the epoch.
  committedAt: number
}

export type RebaseState = 'stack' | 'git' | null

export type Repo = {
  gitDir: string
  commonDir: string
  defaultBranch: string
  currentBranch: string
  branches: Map<string, LocalBranch>
  changedFiles: number
  rebase: RebaseState
  conflicts: string[]
}

// gh stack writes this file while its rebase stops on a conflict.
export const STACK_REBASE_FILE = 'gh-stack-rebase-state'
export const GIT_REBASE_DIRS = ['rebase-merge', 'rebase-apply']

// Parse `%(upstream:track,nobracket)`, for example "ahead 2, behind 1" or
// "gone".
function parseTrack(track: string): [push: number, pull: number] {
  const ahead = Number(track.match(/ahead (\d+)/)?.[1] ?? 0)
  const behind = Number(track.match(/behind (\d+)/)?.[1] ?? 0)
  return [ahead, behind]
}

async function readBranches(
  defaultBranch: string,
): Promise<Map<string, LocalBranch>> {
  // Compare with the local default branch. Use origin's copy when the local
  // branch does not exist.
  const base = (await gitOrNull([
    'rev-parse',
    '--verify',
    '--quiet',
    defaultBranch,
  ]))
    ? defaultBranch
    : `origin/${defaultBranch}`
  const out = await git([
    'for-each-ref',
    `--format=%(refname:short)|%(objectname)|%(upstream:short)|%(upstream:track,nobracket)|%(ahead-behind:${base})|%(committerdate:unix)`,
    'refs/heads',
  ])
  // The branches on origin. `gh stack push` does not set the upstream, so a
  // branch without an upstream can still be on origin.
  const remote = new Set(
    (
      await git([
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/remotes/origin',
      ])
    )
      .split('\n')
      .map((r) => r.replace(/^origin\//, '')),
  )
  const branches = new Map<string, LocalBranch>()
  for (const line of out.split('\n').filter(Boolean)) {
    const [name, sha, rawUpstream, track, aheadBehind, date] = line.split('|')
    let upstream = rawUpstream
    let [unpushed, unpulled] = parseTrack(track)
    if (!upstream && remote.has(name)) {
      upstream = `origin/${name}`
      ;[unpushed, unpulled] = await leftRight(name, upstream)
    }
    const [ahead, behind] = aheadBehind.split(' ').map(Number)
    branches.set(name, {
      name,
      sha,
      upstream: upstream || null,
      upstreamGone: track === 'gone',
      unpushed,
      unpulled,
      aheadOfMain: ahead || 0,
      behindMain: behind || 0,
      committedAt: Number(date),
    })
  }
  return branches
}

// The default branch, as origin/HEAD names it. Without origin/HEAD, use main,
// or master when only master exists.
async function readDefaultBranch(): Promise<string> {
  const ref = await gitOrNull([
    'symbolic-ref',
    '--quiet',
    '--short',
    'refs/remotes/origin/HEAD',
  ])
  if (ref) return ref.replace(/^origin\//, '')
  const hasMain = await gitOrNull(['rev-parse', '--verify', '--quiet', 'main'])
  return hasMain ? 'main' : 'master'
}

export async function readRepo(): Promise<Repo> {
  const [dirs, defaultBranch, head, status] = await Promise.all([
    git([
      'rev-parse',
      '--path-format=absolute',
      '--git-dir',
      '--git-common-dir',
    ]),
    readDefaultBranch(),
    gitOrNull(['symbolic-ref', '--quiet', '--short', 'HEAD']),
    git(['status', '--porcelain']),
  ])
  const [gitDir, commonDir] = dirs.split('\n')
  const branches = await readBranches(defaultBranch)
  const rebase: RebaseState = existsSync(`${gitDir}/${STACK_REBASE_FILE}`)
    ? 'stack'
    : GIT_REBASE_DIRS.some((d) => existsSync(`${gitDir}/${d}`))
      ? 'git'
      : null
  const conflicts = rebase
    ? (await git(['diff', '--name-only', '--diff-filter=U']))
        .split('\n')
        .filter(Boolean)
    : []
  return {
    gitDir,
    commonDir,
    defaultBranch,
    // During a rebase, HEAD is detached, so there is no current branch.
    currentBranch: head ?? '',
    branches,
    changedFiles: status.split('\n').filter(Boolean).length,
    rebase,
    conflicts,
  }
}

// The commits that only `a` has and the commits that only `b` has.
export async function leftRight(
  a: string,
  b: string,
): Promise<[number, number]> {
  const out = await gitOrNull([
    'rev-list',
    '--left-right',
    '--count',
    `${a}...${b}`,
  ])
  const [left, right] = (out ?? '0 0').split(/\s+/).map(Number)
  return [left || 0, right || 0]
}

export type Commit = {
  sha: string
  subject: string
  // The commit time, in seconds since the epoch.
  committedAt: number
}

function parseCommits(out: string | null): Commit[] {
  return (out ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, time, ...subject] = line.split('|')
      return { sha, committedAt: Number(time), subject: subject.join('|') }
    })
}

const COMMIT_FORMAT = '--format=%h|%ct|%s'

export type BranchCommits = {
  // The commits after the parent, newest first.
  commits: Commit[]
  // The commit of the parent that the branch starts from (the merge base).
  // When the parent has new commits, it is not the tip of the parent.
  base: Commit | null
}

export async function branchCommits(
  branch: string,
  parent: string,
  limit = 30,
): Promise<BranchCommits> {
  const [commits, baseSha] = await Promise.all([
    gitOrNull([
      'log',
      `--max-count=${limit}`,
      COMMIT_FORMAT,
      `${parent}..${branch}`,
    ]),
    gitOrNull(['merge-base', parent, branch]),
  ])
  const base = baseSha
    ? parseCommits(await gitOrNull(['log', '-1', COMMIT_FORMAT, baseSha]))[0]
    : undefined
  return { commits: parseCommits(commits), base: base ?? null }
}

// The files with changes that are not committed, as `git status --short`
// shows them.
export async function changedFiles(): Promise<string[]> {
  const out = await git(['status', '--short'])
  return out.split('\n').filter(Boolean)
}
