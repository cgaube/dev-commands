// An undo point for the last rebase or sync.
//
// Before a rebase or a sync, the TUI saves the commit of each branch that
// the operation can change. "Undo" moves the branches back to these
// commits, also after the rebase is done. It changes local branches only:
// when a sync already pushed, push again after the undo.

import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import { execa } from 'execa'
import { gitOrNull, run } from './exec'

// The file is in the git directory of the worktree, so that each worktree
// has its own undo point, and it stays after a restart.
const FILE = 'git-tui-undo.json'

export type Snapshot = {
  label: string
  // The branch that was checked out.
  current: string
  // The commit of each branch.
  branches: Record<string, string>
}

export async function saveSnapshot(
  gitDir: string,
  label: string,
  names: string[],
): Promise<void> {
  const current =
    (await gitOrNull(['symbolic-ref', '--quiet', '--short', 'HEAD'])) ?? ''
  const branches: Record<string, string> = {}
  for (const name of names) {
    const sha = await gitOrNull([
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${name}`,
    ])
    if (sha) branches[name] = sha
  }
  await Bun.write(
    `${gitDir}/${FILE}`,
    JSON.stringify({ label, current, branches }, null, 2),
  )
}

export async function readSnapshot(gitDir: string): Promise<Snapshot | null> {
  const file = Bun.file(`${gitDir}/${FILE}`)
  if (!(await file.exists())) return null
  try {
    return (await file.json()) as Snapshot
  } catch {
    return null
  }
}

// Move the branches back to the snapshot. Stop a rebase that is in progress
// first. Returns the branches that moved.
export async function restoreSnapshot(
  gitDir: string,
  abortRebase: () => Promise<unknown>,
): Promise<string[]> {
  const snapshot = await readSnapshot(gitDir)
  if (!snapshot) throw new Error('nothing to undo')
  if (
    existsSync(`${gitDir}/gh-stack-rebase-state`) ||
    existsSync(`${gitDir}/rebase-merge`) ||
    existsSync(`${gitDir}/rebase-apply`)
  ) {
    await abortRebase()
  }
  // Leave the branches first: git does not move the branch that is checked
  // out with update-ref safely.
  const head = await gitOrNull(['rev-parse', 'HEAD'])
  if (head) await run('git', ['checkout', '--quiet', '--detach'])
  const moved: string[] = []
  for (const [name, sha] of Object.entries(snapshot.branches)) {
    const now = await gitOrNull([
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${name}`,
    ])
    if (now === sha) continue
    await run('git', ['update-ref', `refs/heads/${name}`, sha])
    moved.push(name)
  }
  if (snapshot.current)
    await run('git', ['checkout', '--quiet', snapshot.current])
  await rm(`${gitDir}/${FILE}`, { force: true })
  return moved
}

// Forget the undo point, for example after a push.
export async function clearSnapshot(gitDir: string): Promise<void> {
  await rm(`${gitDir}/${FILE}`, { force: true })
}

// The files that still have conflict markers in the index. Claude can stage
// a file that still has markers, so check before the rebase continues.
export async function filesWithMarkers(): Promise<string[]> {
  // `git diff --check` exits with 2 when it finds a problem, so read the
  // output also on failure.
  const { stdout } = await execa('git', ['diff', '--cached', '--check'], {
    reject: false,
  })
  const out = String(stdout)
  const files = out
    .split('\n')
    .filter((l) => /conflict marker/.test(l))
    .map((l) => l.split(':')[0])
  return [...new Set(files)]
}
