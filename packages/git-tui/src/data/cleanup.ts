// Find the local branches whose work is in the default branch: merged, or
// squash-merged (for example a PR that GitHub merged with "Squash and
// merge"). The same checks as `git delete-merged-branches` and
// `git delete-squashed-branches` of git-extras, but these never touch a
// stack branch: only `gh stack` can delete those, or the stack breaks.

import { git, gitLines, gitOrNull } from './exec'

export type MergedBranch = {
  name: string
  // `merged`: git sees the merge (`git branch -d` works). `squashed`: the
  // changes are in the default branch, but not the commits (`-D` is needed).
  how: 'merged' | 'squashed'
}

// True when the changes of the branch are in `main` as one commit. Make a
// commit with the tree of the branch on its merge base: it holds all the
// changes of the branch. `git cherry` marks it "-" when `main` has a commit
// with the same patch.
async function isSquashed(main: string, branch: string): Promise<boolean> {
  const base = await gitOrNull(['merge-base', main, branch])
  if (!base) return false
  const tree = await git(['rev-parse', `${branch}^{tree}`])
  const probe = await git(['commit-tree', tree, '-p', base, '-m', '_'])
  const cherry = await git(['cherry', main, probe])
  return cherry.startsWith('-')
}

// The branches to delete. `keep`: the branches that must stay, for example
// the stack branches and the current branch. Branches that another worktree
// has checked out also stay: git cannot delete them.
export async function findMergedBranches(
  main: string,
  keep: Set<string>,
): Promise<MergedBranch[]> {
  const format = '--format=%(refname:short) %(worktreepath)'
  const parse = (lines: string[]) =>
    lines
      .map((line) => line.trim().split(' '))
      .filter(
        ([name, worktree]) => name !== main && !keep.has(name) && !worktree,
      )
      .map(([name]) => name)
  const all = parse(await gitLines(['branch', format]))
  const merged = new Set(
    parse(await gitLines(['branch', '--merged', main, format])),
  )
  const result: MergedBranch[] = []
  for (const name of all) {
    if (merged.has(name)) result.push({ name, how: 'merged' })
    else if (await isSquashed(main, name))
      result.push({ name, how: 'squashed' })
  }
  return result
}
