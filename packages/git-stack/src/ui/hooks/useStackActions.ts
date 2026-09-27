import { useMemo } from 'react'
import { execa } from 'execa'
import {
  ghStack,
  isRebaseInProgress,
  PushFailedError,
  readStacks,
} from '#src/stack/ghStack'
import { conflictedFiles, currentBranch } from '#src/utils/git'
import { stackLabel, type LocalStack } from '#src/stack/model'
import { topExistingBranch } from '../rows'

type Run = (label: string, fn: () => Promise<string>) => Promise<void>

// Check out the branch when it is not the current branch. gh stack commands
// act on the stack of the current branch.
async function ensureOn(branch: string) {
  if ((await currentBranch()) !== branch) {
    await execa('git', ['checkout', branch])
  }
}

function plural(count: number): string {
  return `${count} ${count === 1 ? 'stack' : 'stacks'}`
}

// Run a gh stack command. Replace the long gh-stack messages with a short
// message that tells what to do next.
async function ghStackOrHint(
  args: string[],
  env?: Record<string, string>,
): Promise<string> {
  try {
    return await ghStack(args, env)
  } catch (error) {
    // A conflict needs a person, so the TUI does not resolve it. gh stack
    // rebase stops in the middle of the rebase, and r continues it. The
    // legend tells what to do, so name only the files here.
    if (await isRebaseInProgress()) {
      const files = await conflictedFiles()
      if (!files.length) throw error
      const shown = files.slice(0, 3).join(', ')
      const more = files.length > 3 ? ` +${files.length - 3}` : ''
      throw new Error(`conflict in ${shown}${more}`, { cause: error })
    }
    // gh stack sync restores the branches on a conflict. r stops at it.
    if (error instanceof Error && /conflict/i.test(error.message)) {
      throw new Error('conflict — press r to rebase and stop at it', {
        cause: error,
      })
    }
    if (error instanceof PushFailedError) {
      throw new Error('not pushed — press P to push', { cause: error })
    }
    // gh-stack fetches the trunk before most commands, so a remote is
    // necessary. Say how to add one.
    if (error instanceof Error && error.message === 'no remotes configured') {
      throw new Error(
        'no git remote — gh stack needs one: git remote add origin <url>',
        { cause: error },
      )
    }
    throw error
  }
}

// Sync one stack after a merge on GitHub. Sync fetches, rebases the open
// branches onto the trunk, pushes them, and deletes the local branches of
// merged PRs. When all the PRs of the stack are merged, remove the stack from
// local tracking. The stack stays on GitHub.
async function syncStack(stack: LocalStack): Promise<'synced' | 'removed'> {
  const branch = topExistingBranch(stack)
  if (branch) {
    await ensureOn(branch)
    await ghStackOrHint(['sync', '--prune'])
  }
  // A stack without a number is not on GitHub, so it has no merged PRs.
  if (!stack.number) return 'synced'
  // Sync gets the PR state from GitHub, so read the stack again.
  const fresh = (await readStacks()).find((s) => s.number === stack.number)
  const allMerged = fresh?.branches.every((b) => b.pullRequest?.merged)
  if (!allMerged) return 'synced'
  await ghStackOrHint(['unstack', '--local', String(stack.number)])
  return 'removed'
}

// The catalog of operations. Each one is built on the `run` loop of
// useStackData, which sets the busy state and the status, then reloads.
export function useStackActions(run: Run) {
  return useMemo(() => {
    // Sync the stacks one after the other. Stop at the first failure.
    const sync = (stacks: LocalStack[]) =>
      run(`syncing ${plural(stacks.length)}…`, async () => {
        const original = await currentBranch()
        let synced = 0
        let removed = 0
        for (const stack of stacks) {
          try {
            if ((await syncStack(stack)) === 'removed') removed++
            else synced++
          } catch (error) {
            const message = error instanceof Error ? error.message : error
            throw new Error(`stack ${stackLabel(stack)}: ${message}`, {
              cause: error,
            })
          }
        }
        // --prune can delete the original branch. Then stay where sync went.
        await ensureOn(original).catch(() => {})
        const parts = [
          synced ? `synced ${plural(synced)}` : '',
          removed ? `removed ${plural(removed)} (all merged)` : '',
        ]
        return parts.filter(Boolean).join(', ') || 'nothing to sync'
      })

    // Rebase the stacks one after the other, without a push. Stop at the
    // first failure. On a conflict, stay on the branch with the conflict.
    const rebase = (stacks: LocalStack[]) =>
      run(`rebasing ${plural(stacks.length)}…`, async () => {
        const original = await currentBranch()
        let done = 0
        for (const stack of stacks) {
          const branch = topExistingBranch(stack)
          if (!branch) continue
          await ensureOn(branch)
          try {
            await ghStackOrHint(['rebase'])
          } catch (error) {
            const message = error instanceof Error ? error.message : error
            throw new Error(`stack ${stackLabel(stack)}: ${message}`, {
              cause: error,
            })
          }
          done++
        }
        await ensureOn(original)
        return `rebased ${plural(done)} — press P to push`
      })

    return {
      sync,

      rebase,

      // Continue a rebase that stopped on a conflict. Without a terminal, git
      // cannot open an editor for the commit message, so keep the message.
      // gh stack stops again at the next conflict, if there is one.
      continueRebase: () =>
        run('continuing rebase…', async () => {
          await ghStackOrHint(['rebase', '--continue'], { GIT_EDITOR: 'true' })
          return 'rebased — press P to push'
        }),

      checkout: (name: string) =>
        run(`checking out ${name}…`, async () => {
          await execa('git', ['checkout', name])
          return `on ${name}`
        }),

      openPr: (name: string) =>
        run(`opening PR for ${name}…`, async () => {
          try {
            await execa('gh', ['pr', 'view', name, '--web'])
            return `opened PR for ${name}`
          } catch {
            return `no PR found for ${name}`
          }
        }),

      add: (top: string, name: string) =>
        run(`adding ${name}…`, async () => {
          await ensureOn(top)
          return (await ghStackOrHint(['add', name])) || `added ${name}`
        }),

      // Start a new stack. Without a base, gh-stack uses the default branch.
      // gh stack init fails on a branch of a stack, so check out the base.
      init: (name: string, base?: string) =>
        run(`creating stack ${name}…`, async () => {
          if (base) await ensureOn(base)
          const args = base ? ['init', '--base', base, name] : ['init', name]
          return (await ghStackOrHint(args)) || `created stack ${name}`
        }),

      // Push the stack and open its PRs. With --auto, gh-stack makes the new
      // PRs as drafts, with titles from the commits.
      submit: (branch: string) =>
        run('submitting stack…', async () => {
          await ensureOn(branch)
          return (await ghStackOrHint(['submit', '--auto'])) || 'submitted'
        }),

      // Push the stack, then open PRs from the bottom up to `branch` only.
      // gh stack link works on GitHub alone: it opens the missing PRs as
      // drafts, and adds them to the stack of the PRs below. The branches
      // above stay without a PR. The next submit adds them to the same stack.
      // Push first: it is not known if link force-pushes rebased branches.
      submitUpTo: (stack: LocalStack, checkout: string, branch: string) =>
        run(`submitting up to ${branch}…`, async () => {
          const end = stack.branches.findIndex((b) => b.name === branch)
          const open = stack.branches
            .slice(0, end + 1)
            .filter((b) => !b.isMerged)
          const branches = open.map((b) => {
            // A branch that is gone locally can only be linked by its PR.
            if (b.exists) return b.name
            if (b.prNumber) return String(b.prNumber)
            throw new Error(`${b.name} does not exist locally`)
          })
          await ensureOn(checkout)
          await ghStackOrHint(['push'])
          // The PRs are already open. The push updated them.
          if (open.every((b) => b.prNumber)) return `pushed up to ${branch}`
          // A stack on GitHub takes its number first: link then adds only
          // the branches that are not in it. Without a number, link makes a
          // new stack.
          const args = stack.number
            ? ['link', String(stack.number), ...branches]
            : ['link', '--base', stack.trunk, ...branches]
          await ghStackOrHint(args)
          return `submitted up to ${branch} — P submits the rest`
        }),

      notice: (message: string) => run(message, async () => message),
    }
  }, [run])
}
