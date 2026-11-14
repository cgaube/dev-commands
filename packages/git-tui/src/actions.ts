// The actions of the TUI. Each action returns a short message for the status
// bar, or throws an Error with one short line.

import { CommandError, gh, git, gitOrNull, run } from './data/exec'
import type { RebaseState, Repo } from './data/git'
import type { Pr } from './data/github'
import type { Row } from './data/model'
import { clearSnapshot, restoreSnapshot, saveSnapshot } from './data/undo'

// Git cannot open an editor without a terminal. Keep the commit messages.
const NO_EDITOR = { GIT_EDITOR: 'true' }

// gh stack commands act on the stack of the current branch.
async function checkout(name: string) {
  const current = await gitOrNull([
    'symbolic-ref',
    '--quiet',
    '--short',
    'HEAD',
  ])
  if (current !== name) await run('git', ['checkout', name])
}

function stackCommand(args: string[]) {
  return run('gh', ['stack', ...args], { env: NO_EDITOR })
}

async function checkBranchName(name: string) {
  try {
    await git(['check-ref-format', '--branch', name])
  } catch {
    throw new Error(`"${name}" is not a valid branch name`)
  }
}

// After a failed rebase, tell the user about a conflict. Other errors stay
// as they are.
async function explainRebaseError(error: unknown): Promise<never> {
  const files =
    (await gitOrNull(['diff', '--name-only', '--diff-filter=U'])) ?? ''
  const count = files.split('\n').filter(Boolean).length
  if (count) {
    throw new Error(
      `rebase stopped: conflict in ${count} file${count > 1 ? 's' : ''}`,
    )
  }
  throw error
}

export async function checkoutBranch(row: Row): Promise<string> {
  if (!row.exists) throw new Error(`${row.name} does not exist locally`)
  await checkout(row.name)
  return `on ${row.name}`
}

// Start a normal branch from the default branch. Changes that are not
// committed come with it.
export async function newBranch(repo: Repo, name: string): Promise<string> {
  await checkBranchName(name)
  await run('git', ['switch', '-c', name, repo.defaultBranch])
  return `created ${name} from ${repo.defaultBranch}`
}

// Add a branch after the top of the stack. On a normal branch, make a stack:
// the branch is the first one, and the new branch comes after it.
export async function stackBranch(
  repo: Repo,
  row: Row,
  name: string,
): Promise<string> {
  await checkBranchName(name)
  if (row.stack) {
    await checkout(row.stack.top)
    await stackCommand(['add', name])
    return `added ${name} after ${row.stack.top}`
  }
  if (row.kind !== 'branch') throw new Error('select a branch first')
  await checkout(row.name)
  await stackCommand(['init', '--base', repo.defaultBranch, row.name, name])
  return `made a stack: ${row.name} → ${name}`
}

// Push the branch and open a draft PR. For a stack, push all its branches
// and open the missing PRs.
export async function push(
  repo: Repo,
  row: Row,
  pr: Pr | undefined,
): Promise<string> {
  if (row.stack) {
    await checkout(row.name)
    await stackCommand(['submit', '--auto'])
    await clearSnapshot(repo.gitDir)
    return 'pushed the stack'
  }
  if (row.kind !== 'branch')
    throw new Error('push the default branch in a terminal')
  if (row.ahead === 0) throw new Error(`${row.name} has no commits to push`)
  await run('git', ['push', '--force-with-lease', '-u', 'origin', row.name])
  await clearSnapshot(repo.gitDir)
  if (pr && pr.status !== 'merged' && pr.status !== 'closed') {
    return `pushed, PR #${pr.number} updated`
  }
  await gh([
    'pr',
    'create',
    '--draft',
    '--fill',
    '--head',
    row.name,
    '--base',
    repo.defaultBranch,
  ])
  return `pushed, draft PR opened`
}

// Update the default branch from origin. Never force: when the local branch
// has its own commits, stop.
async function updateTrunk(repo: Repo): Promise<string> {
  const main = repo.defaultBranch
  await run('git', ['fetch', 'origin', main])
  if (repo.currentBranch === main) {
    await run('git', ['merge', '--ff-only', `origin/${main}`])
  } else {
    // Git does not fetch into the branch that is checked out, so this is
    // safe. It fails when the update is not a fast-forward.
    await run('git', ['fetch', 'origin', `${main}:${main}`]).catch(() => {
      throw new Error(`${main} has local commits — not updated`)
    })
  }
  return `${main} is up to date`
}

// Sync a stack with GitHub: fetch, rebase onto the trunk, push, and delete
// the local branches of merged PRs. On the trunk, update the trunk only.
export async function sync(repo: Repo, row: Row): Promise<string> {
  if (row.kind === 'trunk') return updateTrunk(repo)
  if (!row.stack) throw new Error('sync works on stacks. Use r to rebase')
  await saveSnapshot(repo.gitDir, 'sync', row.stack.branches)
  await checkout(row.exists ? row.name : row.stack.top)
  const out = await stackCommand(['sync', '--prune']).catch(explainRebaseError)
  // gh stack sync does not force-push. After a rebase, it only warns.
  if (/Push failed/.test(out)) return 'synced, but the push failed: press p'
  return 'synced the stack'
}

// Rebase onto the parent, without a push.
export async function rebase(repo: Repo, row: Row): Promise<string> {
  if (row.stack) {
    await saveSnapshot(repo.gitDir, 'rebase', row.stack.branches)
    await checkout(row.name)
    await stackCommand(['rebase']).catch(explainRebaseError)
    return 'rebased the stack. Press p to push'
  }
  if (row.kind !== 'branch') throw new Error('nothing to rebase')
  if (row.behind === 0) return `${row.name} already has ${repo.defaultBranch}`
  await saveSnapshot(repo.gitDir, 'rebase', [row.name])
  await run('git', ['rebase', repo.defaultBranch, row.name], {
    env: NO_EDITOR,
  }).catch(explainRebaseError)
  return `rebased ${row.name}. Press p to push`
}

export async function continueRebase(state: RebaseState): Promise<string> {
  if (state === 'stack') {
    await stackCommand(['rebase', '--continue']).catch(explainRebaseError)
  } else {
    await run('git', ['rebase', '--continue'], { env: NO_EDITOR }).catch(
      explainRebaseError,
    )
  }
  return 'rebase done. Press p to push'
}

export async function abortRebase(state: RebaseState): Promise<string> {
  if (state === 'stack') await stackCommand(['rebase', '--abort'])
  else await run('git', ['rebase', '--abort'])
  return 'rebase aborted, branches restored'
}

// Remove a finished stack from local tracking (`gh stack unstack --local`).
// The stack stays on GitHub. gh stack unstack acts on the stack of the
// current branch, so check out a branch of the stack first. When no branch
// of the stack exists (sync deleted the merged branches), make the first
// one again at the trunk for a moment, and delete it after.
export async function removeStack(repo: Repo, row: Row): Promise<string> {
  const stack = row.stack
  if (!stack) throw new Error('select a stack branch')
  const id = stack.number ? `stack #${stack.number}` : 'the stack'
  if (stack.number) {
    await stackCommand(['unstack', '--local', String(stack.number)])
    return `removed ${id} from this repository`
  }
  const back = repo.currentBranch
  const local = stack.branches.find((name) => repo.branches.has(name))
  if (local) {
    await checkout(local)
    try {
      await stackCommand(['unstack', '--local'])
    } finally {
      if (back) await checkout(back)
    }
    return `removed ${id} from this repository`
  }
  const name = stack.branches[0]
  await run('git', ['switch', '-c', name, stack.trunk])
  try {
    await stackCommand(['unstack', '--local'])
  } finally {
    if (back) await run('git', ['switch', back])
    await run('git', ['branch', '-D', name])
  }
  return `removed ${id} from this repository`
}

// Move the branches back to where they were before the last rebase or
// sync.
export async function undo(repo: Repo): Promise<string> {
  const moved = await restoreSnapshot(repo.gitDir, () =>
    abortRebase(repo.rebase),
  )
  if (!moved.length) return 'nothing changed: the branches were already there'
  return `restored ${moved.join(', ')}. Push again if the rebase was pushed`
}

// Delete a local branch, and also its remote branch when asked. `force` uses
// `git branch -D` for a branch that git thinks is not merged.
export async function deleteBranch(
  row: Row,
  { force, remote }: { force: boolean; remote: boolean },
): Promise<string> {
  if (row.kind !== 'branch')
    throw new Error('only normal branches can be deleted here')
  if (row.isCurrent) throw new Error('you cannot delete the current branch')
  try {
    await run('git', ['branch', force ? '-D' : '-d', row.name])
  } catch (error) {
    if (
      !force &&
      error instanceof CommandError &&
      /not fully merged/.test(error.message)
    ) {
      throw new NotMergedError(row.name)
    }
    throw error
  }
  if (remote && row.hasRemote) {
    await run('git', ['push', 'origin', '--delete', row.name])
    return `deleted ${row.name} and origin/${row.name}`
  }
  return `deleted ${row.name}`
}

export class NotMergedError extends Error {
  constructor(name: string) {
    super(`${name} is not merged. Delete it anyway?`)
  }
}

export async function openPr(pr: Pr | undefined): Promise<string> {
  if (!pr) throw new Error('this branch has no PR')
  await gh(['pr', 'view', String(pr.number), '--web'])
  return `opened PR #${pr.number}`
}

// Open a link in the browser, for example the page of a CI check.
export async function openUrl(url: string): Promise<string> {
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  await run(opener, [url])
  return `opened ${url}`
}
