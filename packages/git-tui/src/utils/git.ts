import { existsSync } from 'fs'
import { execa } from 'execa'

// Apply to every read-only git command. GIT_OPTIONAL_LOCKS=0 stops them
// (notably `git status`) from taking the index lock to refresh its stat cache.
// This prevents lock contention with other git processes. It also prevents a
// reload loop in the TUI, which watches the git directory.
export const READ_ONLY_GIT_ENV = { GIT_OPTIONAL_LOCKS: '0' } as const

export async function gitOutput(args: string[]): Promise<string> {
  const { stdout } = await execa('git', args, { env: READ_ONLY_GIT_ENV })
  return stdout.toString()
}

// Resolve a ref to its full commit sha. Returns null when the ref does not
// exist, so that callers can show a missing branch as "gone".
export async function resolveSha(ref: string): Promise<string | null> {
  try {
    return (await gitOutput(['rev-parse', '--verify', '--quiet', ref])).trim()
  } catch {
    return null
  }
}

export async function isAncestor(commit: string, of: string): Promise<boolean> {
  try {
    await execa('git', ['merge-base', '--is-ancestor', commit, of], {
      env: READ_ONLY_GIT_ENV,
    })
    return true
  } catch {
    return false
  }
}

export async function gitDir(): Promise<string> {
  return (await gitOutput(['rev-parse', '--absolute-git-dir'])).trim()
}

// The git directory of this worktree, and the directory that all worktrees
// share. In the main worktree they are the same. In a linked worktree, the
// git directory is `.git/worktrees/<name>`: it has HEAD and the gh-stack
// file. The branches and packed-refs are in the shared directory.
export async function gitDirs(): Promise<{
  gitDir: string
  commonDir: string
}> {
  const out = await gitOutput([
    'rev-parse',
    '--path-format=absolute',
    '--git-dir',
    '--git-common-dir',
  ])
  const [dir, commonDir] = out.trim().split('\n')
  return { gitDir: dir, commonDir }
}

export async function currentBranch(): Promise<string> {
  return (await gitOutput(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
}

// The files that still have a merge conflict, during a rebase.
export async function conflictedFiles(): Promise<string[]> {
  const out = await gitOutput(['diff', '--name-only', '--diff-filter=U'])
  return out.split('\n').filter(Boolean)
}

export async function isWorkingTreeDirty(): Promise<boolean> {
  const out = await gitOutput(['status', '--porcelain'])
  return out.split(/\r?\n/).some((l) => l.trim().length > 0)
}

export async function commitCount(
  base: string,
  branch: string,
): Promise<number> {
  try {
    const out = (
      await gitOutput(['rev-list', '--count', `${base}..${branch}`])
    ).trim()
    return Number(out) || 0
  } catch {
    return 0
  }
}

// Count the commits that only a has and the commits that only b has.
export async function leftRightCount(
  a: string,
  b: string,
): Promise<[number, number]> {
  try {
    const out = (
      await gitOutput(['rev-list', '--left-right', '--count', `${a}...${b}`])
    ).trim()
    const [left, right] = out.split(/\s+/).map(Number)
    return [left || 0, right || 0]
  } catch {
    return [0, 0]
  }
}

// Map each ref under the pattern to the time of its last commit, in seconds
// since the epoch, keyed by the short ref name.
export async function refDates(pattern: string): Promise<Map<string, number>> {
  const out = await gitOutput([
    'for-each-ref',
    '--format=%(refname:short) %(committerdate:unix)',
    pattern,
  ])
  const dates = new Map<string, number>()
  for (const line of out.split('\n')) {
    const sep = line.lastIndexOf(' ')
    if (sep === -1) continue
    dates.set(line.slice(0, sep), Number(line.slice(sep + 1)))
  }
  return dates
}

// Map each ref under the pattern to its sha, keyed by the short ref name.
export async function refShas(pattern: string): Promise<Map<string, string>> {
  const out = await gitOutput([
    'for-each-ref',
    '--format=%(refname:short) %(objectname)',
    pattern,
  ])
  const shas = new Map<string, string>()
  for (const line of out.split('\n')) {
    const sep = line.indexOf(' ')
    if (sep === -1) continue
    shas.set(line.slice(0, sep), line.slice(sep + 1))
  }
  return shas
}

// The default branch of the repository, as origin/HEAD names it. Without
// origin/HEAD, use main or master, whichever exists locally.
export async function defaultBranch(
  local: Map<string, string>,
): Promise<string> {
  try {
    const ref = await gitOutput([
      'symbolic-ref',
      '--quiet',
      '--short',
      'refs/remotes/origin/HEAD',
    ])
    return ref.trim().replace(/^origin\//, '')
  } catch {
    return local.has('master') && !local.has('main') ? 'master' : 'main'
  }
}

// True while a plain git rebase stopped, e.g. on a conflict. Git keeps its
// state in one of these directories of the worktree's git directory.
export const GIT_REBASE_DIRS = ['rebase-merge', 'rebase-apply']

export function isGitRebaseInProgress(dir: string): boolean {
  return GIT_REBASE_DIRS.some((name) => existsSync(`${dir}/${name}`))
}
