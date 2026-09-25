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

export async function currentBranch(): Promise<string> {
  return (await gitOutput(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
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
