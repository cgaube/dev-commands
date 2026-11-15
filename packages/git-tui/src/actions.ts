// The actions of the TUI. Each action returns a short message for the status
// bar, or throws an Error with one short line.

import { CommandError, gh, git, gitOrNull, run } from './data/exec'
import type { RebaseState, Repo } from './data/git'
import type { Pr } from './data/github'
import type { MergedBranch } from './data/cleanup'
import type { Row } from './data/model'
import type { CommitScope } from './commitMessage'
import { joinText, type PrText } from './prDescription'
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

// Push the branch to origin, without a PR. An open PR gets the new commits.
// For a stack, push all its branches (`gh stack push`, with a lease for each
// branch).
export async function push(
  repo: Repo,
  row: Row,
  pr: Pr | undefined,
): Promise<string> {
  if (row.stack) {
    await checkout(row.name)
    await stackCommand(['push'])
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
  return 'pushed. Press P to create a PR'
}

// Push the branches of a stack from the bottom up to one branch. The
// branches above it stay local. `names`: the branches to push, from the
// bottom, without the merged ones. Each branch has its own lease, as with
// gh stack push.
export async function pushStackUpTo(
  repo: Repo,
  names: string[],
): Promise<string> {
  if (!names.length) throw new Error('no branch to push')
  await run('git', ['push', '--force-with-lease', 'origin', ...names])
  await clearSnapshot(repo.gitDir)
  const count = `${names.length} branch${names.length > 1 ? 'es' : ''}`
  return `pushed ${count} up to ${names.at(-1)}`
}

// Commit on the current branch with this message. `all` adds all the
// changes first, also the new files.
export async function commit(
  scope: CommitScope,
  message: PrText,
): Promise<string> {
  if (scope === 'all') await run('git', ['add', '--all'])
  await run('git', ['commit', '--file', '-'], {
    input: joinText(message),
    env: NO_EDITOR,
  })
  const sha = await git(['rev-parse', '--short', 'HEAD'])
  return `committed ${sha}. Press p to push`
}

// Push all the branches of a stack, and open the missing PRs as drafts.
export async function submitStack(repo: Repo, row: Row): Promise<string> {
  if (!row.stack) throw new Error('select a stack branch')
  await checkout(row.name)
  await stackCommand(['submit', '--auto'])
  await clearSnapshot(repo.gitDir)
  return 'pushed the stack, PRs opened'
}

// Push a normal branch, and open a PR with the title and the description
// that the user saw. Without them, gh fills the PR from the commits.
export async function createPr(
  repo: Repo,
  row: Row,
  { text, draft }: { text: PrText | null; draft: boolean },
): Promise<string> {
  if (row.kind !== 'branch') throw new Error('select a normal branch')
  await run('git', ['push', '--force-with-lease', '-u', 'origin', row.name])
  await clearSnapshot(repo.gitDir)
  // The body goes through stdin: it can be long, and start with "-".
  const url = await run(
    'gh',
    [
      'pr',
      'create',
      ...(draft ? ['--draft'] : []),
      '--head',
      row.name,
      '--base',
      repo.defaultBranch,
      ...(text ? ['--title', text.title, '--body-file', '-'] : ['--fill']),
    ],
    text ? { input: text.body } : {},
  )
  const number = url.match(/\/pull\/(\d+)/)?.[1]
  const kind = draft ? 'draft PR' : 'PR'
  return number ? `pushed, ${kind} #${number} opened` : `pushed, ${kind} opened`
}

// Update the default branch from origin. Never force: when the local branch
// has its own commits, stop.
export async function updateTrunk(repo: Repo): Promise<string> {
  const main = repo.defaultBranch
  const before = await git(['rev-parse', main])
  // Fetch all of origin, and remove the remote branches that GitHub deleted
  // (for example after a merge).
  await run('git', ['fetch', '--prune', 'origin'])
  if (repo.currentBranch === main) {
    await run('git', ['merge', '--ff-only', `origin/${main}`])
  } else {
    // Git does not fetch into the branch that is checked out, so this is
    // safe. It fails when the update is not a fast-forward.
    await run('git', ['fetch', 'origin', `${main}:${main}`]).catch(() => {
      throw new Error(`${main} has local commits — not updated`)
    })
  }
  // Tell what came: "up to date" alone does not show that a merge came.
  const count = Number(await git(['rev-list', '--count', `${before}..${main}`]))
  if (!count) return `${main} was already up to date`
  const pulled = `${main}: pulled ${count} commit${count > 1 ? 's' : ''}`
  // The other branches do not get the commits: they need a rebase.
  return repo.currentBranch && repo.currentBranch !== main
    ? `${pulled}. Press r on ${repo.currentBranch} to rebase it`
    : pulled
}

// Sync each of these stacks (one row of each stack), then check out the
// branch of the user again. When a sync deleted that branch, check out the
// default branch. A conflict stops all: the user fixes the rebase first.
export async function syncStacks(repo: Repo, rows: Row[]): Promise<string> {
  const back = repo.currentBranch
  for (const row of rows) await sync(repo, row)
  const target =
    back && (await gitOrNull(['rev-parse', '--verify', `refs/heads/${back}`]))
      ? back
      : repo.defaultBranch
  await checkout(target)
  return `synced ${rows.length} stack${rows.length > 1 ? 's' : ''}`
}

// Delete local branches whose work is in the default branch. See
// data/cleanup.ts. A squash-merged branch needs -D: git does not see that
// merge.
export async function deleteMergedBranches(
  branches: MergedBranch[],
): Promise<string> {
  const failed: string[] = []
  for (const { name, how } of branches) {
    await run('git', ['branch', how === 'merged' ? '-d' : '-D', name]).catch(
      () => failed.push(name),
    )
  }
  const done = branches.length - failed.length
  const deleted = `deleted ${done} branch${done === 1 ? '' : 'es'}`
  return failed.length ? `${deleted}, not ${failed.join(', ')}` : deleted
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
