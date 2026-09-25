import type { LocalStack, StackBranch, StackState } from '#src/stack/model'

// One selectable line of the tree: a trunk, or a branch of a stack.
export type Row = {
  name: string
  // 0 for a trunk. A branch is one level below its parent.
  depth: number
  isCurrent: boolean
  // For a trunk row: null. For a branch row: the branch and its stack.
  branch: StackBranch | null
  stack: LocalStack | null
  // For a trunk row: all the stacks on this trunk. For a branch row: its stack.
  stacks: LocalStack[]
  // True on the bottom branch of a stack, where the stack number shows.
  isStackStart: boolean
}

// A key that stays the same for a row when other rows change. A branch is in
// one stack only, so its name is sufficient.
export function rowKey(row: Row): string {
  return row.branch ? `branch:${row.name}` : `trunk:${row.name}`
}

// Show the stacks as a tree. Each trunk shows one time, and all the stacks on
// that trunk hang below it. Each branch is one level below its parent:
//
//   main
//     a
//       b
//     c
//       d
export function toRows(state: StackState | undefined): Row[] {
  if (!state) return []
  const byTrunk = new Map<string, LocalStack[]>()
  for (const stack of state.stacks) {
    byTrunk.set(stack.trunk, [...(byTrunk.get(stack.trunk) ?? []), stack])
  }
  return [...byTrunk].flatMap(([trunk, stacks]) => [
    {
      name: trunk,
      depth: 0,
      isCurrent: state.currentBranch === trunk,
      branch: null,
      stack: null,
      stacks,
      isStackStart: false,
    },
    ...stacks.flatMap((stack) =>
      stack.branches.map((branch, i): Row => ({
        name: branch.name,
        depth: i + 1,
        isCurrent: branch.isCurrent,
        branch,
        stack,
        stacks: [stack],
        isStackStart: i === 0,
      })),
    ),
  ])
}

// The top branch of a stack that exists locally. A stack command checks it
// out first, because gh stack commands act on the stack of the current branch.
export function topExistingBranch(stack: LocalStack): string | null {
  return stack.branches.filter((b) => b.exists).at(-1)?.name ?? null
}
