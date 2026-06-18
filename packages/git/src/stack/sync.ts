import { gitOutput, resolveSha } from '#src/utils/git'
import { readMeta, writeMeta } from './model'
import { restack, stackOrder, type RestackResult } from './restack'

// Has `branch` already landed in `trunk`? Pure-git, squash-aware:
//   1. Fast path — every commit on the branch is already contained in trunk
//      (covers plain merges, fast-forwards and rebase-merges).
//   2. Squash path — merging the branch into trunk would produce trunk's exact
//      tree, i.e. the branch introduces no changes trunk doesn't already have.
//      This catches squash-merges, where the original commits never appear in
//      trunk but their net effect does.
// A non-existent branch ref counts as merged so sync can clean up after a
// branch that was merged and deleted on the remote.
export async function isMerged(
  branch: string,
  trunk: string,
): Promise<boolean> {
  if (!(await resolveSha(branch))) return true

  const unique = (
    await gitOutput(['rev-list', '--count', branch, '--not', trunk])
  ).trim()
  if (unique === '0') return true

  try {
    const merged = (
      await gitOutput(['merge-tree', '--write-tree', trunk, branch])
    )
      .trim()
      .split('\n')[0]
    const trunkTree = (await gitOutput(['rev-parse', `${trunk}^{tree}`])).trim()
    return merged === trunkTree
  } catch {
    // merge-tree exits non-zero on conflicts → branch is not cleanly merged.
    return false
  }
}

export type SyncResult = {
  merged: string[]
  restack: RestackResult
}

// Reconcile the stack with reality: find tracked branches that have landed in
// trunk, lift their children up onto the merged branch's own parent (toward
// trunk), drop the merged branches from metadata, then restack the survivors.
//
// Each child keeps its recorded parentSha (the merged branch's old tip), so the
// subsequent `rebase --onto` replays only the child's own commits and cleanly
// drops the now-merged ones — even across a chain of merged branches, because we
// process parents before children.
export async function sync(): Promise<SyncResult> {
  const meta = await readMeta()
  const { trunk } = meta
  const merged: string[] = []

  for (const name of stackOrder(meta)) {
    if (!meta.branches[name]) continue
    if (!(await isMerged(name, trunk))) continue

    const grandparent = meta.branches[name].parent
    for (const info of Object.values(meta.branches)) {
      if (info.parent === name) info.parent = grandparent
    }
    delete meta.branches[name]
    merged.push(name)
  }

  await writeMeta(meta)
  const result = await restack()
  return { merged, restack: result }
}
