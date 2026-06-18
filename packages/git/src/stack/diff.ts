import { gitOutput, truncateDiff } from '#src/utils/git'
import { readMeta, type StackMeta } from './model'

// The diff a single branch introduces on top of its parent — i.e. "what this
// branch/PR adds". Uses the two-dot `parent..branch` form so it reflects the
// branch's own commits relative to where it currently sits. Large diffs are
// clamped (shared with the AI commands) so a huge branch can't blow up the pane.
export async function branchDiff(
  branch: string,
  meta?: StackMeta,
): Promise<{ text: string; truncated: boolean }> {
  const data = meta ?? (await readMeta())
  const info = data.branches[branch]
  const base = info ? info.parent : data.trunk
  const raw = await gitOutput(['diff', `${base}..${branch}`])
  return truncateDiff(raw)
}
