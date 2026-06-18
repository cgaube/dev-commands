import { execa } from 'execa'
import { gitOutput, resolveSha } from '#src/utils/git'
import { readMeta, writeMeta, type StackMeta } from './model'

// Tracked branches ordered parent-before-child, so a restack walk always
// rebases a parent onto its new base before any of its children. Parents that
// aren't themselves tracked (trunk, or an untracked branch) count as already
// "present", making their children eligible immediately.
export function stackOrder(meta: StackMeta): string[] {
  const names = Object.keys(meta.branches)
  const tracked = new Set(names)
  const added = new Set<string>()
  const result: string[] = []

  let progress = true
  while (result.length < names.length && progress) {
    progress = false
    for (const name of names) {
      if (added.has(name)) continue
      const { parent } = meta.branches[name]
      if (!tracked.has(parent) || added.has(parent)) {
        result.push(name)
        added.add(name)
        progress = true
      }
    }
  }
  // Append anything left (e.g. a metadata cycle) so we never silently drop it.
  for (const name of names) if (!added.has(name)) result.push(name)
  return result
}

export type RestackResult = {
  restacked: string[]
  skipped: string[]
  conflict?: { branch: string; message: string }
}

// Rebase each tracked branch onto its parent's current tip, walking top-down.
// We rebase by range (`--onto <newBase> <recordedParentSha> <branch>`) so only
// the branch's own commits replay — this is what drops a parent's commits after
// it was squash-merged, and avoids re-applying commits the parent already has.
//
// `only` limits the walk to a subset of branches (e.g. one stack) while keeping
// global parent-before-child ordering. On the first conflict we stop and leave
// the repo mid-rebase so the user can resolve and `git rebase --continue`.
export async function restack(only?: string[]): Promise<RestackResult> {
  const meta = await readMeta()
  const limit = only ? new Set(only) : null
  const order = stackOrder(meta).filter((b) => !limit || limit.has(b))

  const original = (
    await gitOutput(['rev-parse', '--abbrev-ref', 'HEAD'])
  ).trim()
  const result: RestackResult = { restacked: [], skipped: [] }

  for (const branch of order) {
    const info = meta.branches[branch]
    if (!(await resolveSha(branch))) {
      // Branch ref is gone (e.g. deleted after merge); sync handles cleanup.
      result.skipped.push(branch)
      continue
    }

    const parentTip = await resolveSha(info.parent)
    if (!parentTip) {
      // Parent missing — can't compute a base here; sync re-parents these.
      result.skipped.push(branch)
      continue
    }
    if (parentTip === info.parentSha) {
      // Already sitting on the parent's current tip; nothing to replay.
      result.skipped.push(branch)
      continue
    }

    try {
      await execa('git', [
        'rebase',
        '--onto',
        parentTip,
        info.parentSha,
        branch,
      ])
    } catch (error) {
      result.conflict = {
        branch,
        message:
          error instanceof Error
            ? error.message
            : 'rebase failed with conflicts',
      }
      // Leave the repo mid-rebase for the user to resolve; persist progress so
      // far so already-restacked branches keep their updated base.
      await writeMeta(meta)
      return result
    }

    info.parentSha = parentTip
    result.restacked.push(branch)
  }

  await writeMeta(meta)
  // Return to where we started; the rebases checked out each branch in turn.
  if (await resolveSha(original)) {
    await execa('git', ['checkout', original])
  }
  return result
}
