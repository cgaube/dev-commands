// Fix all the conflicts of a rebase with Claude, and continue the rebase
// after each fix, until the rebase is done.

import { continueRebase } from './actions'
import { resolveConflicts, type AgentRun } from './claude'
import { readRepo } from './data/git'
import { filesWithMarkers } from './data/undo'

// A stack rebase can stop one time for each commit. Stop after this number
// of rounds, so that a loop cannot go on without end.
const MAX_ROUNDS = 20

export type ResolveCallbacks = {
  // A new round starts: the rebase stopped on these files.
  onRound: (round: number, files: string[]) => void
  // Claude used a tool, for example "editing src/a.ts".
  onStep: (text: string) => void
  // Claude finished a round. The summary tells how it resolved each file.
  onSummary: (summary: string) => void
  // The current Claude run, so that the user can stop it.
  onRun: (run: AgentRun | null) => void
}

export async function autoResolve(cb: ResolveCallbacks): Promise<string> {
  let rounds = 0
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const repo = await readRepo()
    if (!repo.rebase) {
      return rounds
        ? `Claude fixed ${rounds} conflict${rounds > 1 ? 's' : ''}, rebase done. Review, then press p (u undoes)`
        : 'no rebase in progress'
    }
    if (repo.conflicts.length) {
      rounds++
      cb.onRound(round, repo.conflicts)
      const run = resolveConflicts(repo, cb.onStep)
      cb.onRun(run)
      try {
        cb.onSummary(await run.result)
      } finally {
        cb.onRun(null)
      }
      // Claude does not stage a file that it cannot resolve safely.
      const left = (await readRepo()).conflicts
      if (left.length) {
        throw new Error(
          `Claude did not resolve ${left.join(', ')}. Fix it, git add it, then press c`,
        )
      }
      const markers = await filesWithMarkers()
      if (markers.length) {
        throw new Error(
          `conflict markers are left in ${markers.join(', ')}. Fix them, git add them, then press c`,
        )
      }
    }
    try {
      await continueRebase(repo.rebase)
    } catch (error) {
      // The next commit has a conflict too: do the next round.
      if (
        error instanceof Error &&
        error.message.startsWith('rebase stopped')
      ) {
        continue
      }
      throw error
    }
  }
  throw new Error(`stopped after ${MAX_ROUNDS} rounds. Press a to go on`)
}
