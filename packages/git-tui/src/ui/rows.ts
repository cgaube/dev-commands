import type { LocalStack, Branch, StackState } from '#src/stack/model'

// A trunk, a branch of a stack, or a plain branch (not in a stack).
export type RowKind = 'trunk' | 'stack' | 'plain'

// One selectable line of the tree.
export type Row = {
  kind: RowKind
  name: string
  // 0 for a trunk. A branch is one level below its parent.
  depth: number
  isCurrent: boolean
  // For a trunk row: null. For a branch row: the branch. For a stack row:
  // also its stack.
  branch: Branch | null
  stack: LocalStack | null
  // For a trunk row: all the stacks on this trunk. For a stack row: its
  // stack. For a plain row: none.
  stacks: LocalStack[]
  // True on the first branch of a stack, where the stack number shows.
  isStackStart: boolean
}

// A key that stays the same for a row when other rows change. A branch is in
// one stack only, so its name is sufficient. A plain branch that becomes a
// stack branch keeps its key, so the selection stays on it.
export function rowKey(row: Row): string {
  return row.branch ? `branch:${row.name}` : `trunk:${row.name}`
}

// Show the branches as a tree. Each trunk shows one time, and all the stacks
// on that trunk hang below it. Each stack branch is one level below its
// parent. The plain branches hang below the default branch, after its
// stacks:
//
//   main
//     a        (stack)
//       b
//     c        (plain)
//     d        (plain)
export function toRows(state: StackState | undefined): Row[] {
  if (!state) return []
  // The default branch always shows, also without stacks.
  const byTrunk = new Map<string, LocalStack[]>([[state.defaultBranch, []]])
  for (const stack of state.stacks) {
    byTrunk.set(stack.trunk, [...(byTrunk.get(stack.trunk) ?? []), stack])
  }
  return [...byTrunk].flatMap(([trunk, stacks]): Row[] => [
    {
      kind: 'trunk',
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
        kind: 'stack',
        name: branch.name,
        depth: i + 1,
        isCurrent: branch.isCurrent,
        branch,
        stack,
        stacks: [stack],
        isStackStart: i === 0,
      })),
    ),
    ...(trunk === state.defaultBranch ? state.branches : []).map(
      (branch): Row => ({
        kind: 'plain',
        name: branch.name,
        depth: 1,
        isCurrent: branch.isCurrent,
        branch,
        stack: null,
        stacks: [],
        isStackStart: false,
      }),
    ),
  ])
}

// The top branch of a stack that exists locally. A stack command checks it
// out first, because gh stack commands act on the stack of the current branch.
export function topExistingBranch(stack: LocalStack): string | null {
  return stack.branches.filter((b) => b.exists).at(-1)?.name ?? null
}
