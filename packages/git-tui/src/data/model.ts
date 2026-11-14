import { leftRight, readRepo, type Repo } from './git'
import { readStacks, type Stack } from './stacks'
import { readSnapshot, type Snapshot } from './undo'

export type RowKind = 'trunk' | 'stack' | 'branch'

// One branch in the list.
export type Row = {
  name: string
  kind: RowKind
  // The branch that this branch starts from. For a stack branch, it is the
  // first unmerged branch below it, or the trunk.
  parent: string
  // False for a merged stack branch that `gh stack sync` deleted locally.
  exists: boolean
  isCurrent: boolean
  // The commits after the parent.
  ahead: number
  // The commits of the parent that this branch does not have. More than 0
  // means that the branch needs a rebase.
  behind: number
  unpushed: number
  unpulled: number
  hasRemote: boolean
  upstreamGone: boolean
  merged: boolean
  committedAt: number | null
  // The stack of the branch. Only for stack branches.
  stack: StackRef | null
}

export type StackRef = {
  number: number | null
  trunk: string
  // The position in the stack, from 1 (next to the trunk).
  position: number
  size: number
  // The top branch of the stack. `gh stack add` adds after it.
  top: string
  // All the branches of the stack, from the bottom.
  branches: string[]
}

export type Section = {
  kind: RowKind
  title: string
  rows: Row[]
}

export type Model = {
  repo: Repo
  // The undo point of the last rebase or sync, if there is one.
  undo: Snapshot | null
  sections: Section[]
  // All the rows of all the sections, in the order the list shows them.
  rows: Row[]
}

function localRow(
  repo: Repo,
  name: string,
  kind: RowKind,
  parent: string,
): Row {
  const b = repo.branches.get(name)
  return {
    name,
    kind,
    parent,
    exists: !!b,
    isCurrent: name === repo.currentBranch,
    ahead: b?.aheadOfMain ?? 0,
    behind: b?.behindMain ?? 0,
    unpushed: b?.unpushed ?? 0,
    unpulled: b?.unpulled ?? 0,
    hasRemote: !!b?.upstream && !b.upstreamGone,
    upstreamGone: !!b?.upstreamGone,
    merged: false,
    committedAt: b?.committedAt ?? null,
    stack: null,
  }
}

async function stackSection(repo: Repo, stack: Stack): Promise<Section> {
  const top = stack.branches.at(-1)?.name ?? stack.trunk
  const rows = await Promise.all(
    stack.branches.map(async (ref, i): Promise<Row> => {
      // A merged branch is no longer a parent: gh stack rebases the branches
      // above it onto the next unmerged branch below, or onto the trunk.
      const below = stack.branches.slice(0, i).filter((b) => !b.merged)
      let parent = below.at(-1)?.name ?? stack.trunk
      if (!repo.branches.has(parent)) parent = stack.trunk
      const row = localRow(repo, ref.name, 'stack', parent)
      if (row.exists && parent !== repo.defaultBranch) {
        ;[row.behind, row.ahead] = await leftRight(parent, ref.name)
      }
      return {
        ...row,
        merged: ref.merged,
        stack: {
          number: stack.number,
          trunk: stack.trunk,
          position: i + 1,
          size: stack.branches.length,
          top,
          branches: stack.branches.map((b) => b.name),
        },
      }
    }),
  )
  const id = stack.number ? `stack #${stack.number}` : 'stack (local)'
  // Stacks start from the default branch. Show the trunk only when it is
  // another branch, for a stack that a terminal command made.
  const on = stack.trunk === repo.defaultBranch ? '' : ` on ${stack.trunk}`
  // gh stack thinks from the bottom. Show the top first, as on GitHub.
  return { kind: 'stack', title: `${id}${on}`, rows: rows.toReversed() }
}

export async function loadModel(): Promise<Model> {
  const repo = await readRepo()
  const stacks = await readStacks(repo.gitDir)
  const main = repo.defaultBranch

  const inStack = new Set(stacks.flatMap((s) => s.branches.map((b) => b.name)))
  const plain = [...repo.branches.keys()]
    .filter((name) => name !== main && !inStack.has(name))
    .map((name) => localRow(repo, name, 'branch', main))
    // The most recent work first.
    .toSorted((a, b) => (b.committedAt ?? 0) - (a.committedAt ?? 0))

  const trunk = localRow(repo, main, 'trunk', `origin/${main}`)
  trunk.ahead = trunk.unpushed
  trunk.behind = trunk.unpulled

  // Show the list as `gh stack view` does: the newest work on top, and the
  // default branch at the bottom, because all the work starts from it.
  const sections: Section[] = await Promise.all(
    stacks.map((s) => stackSection(repo, s)),
  )
  if (plain.length) {
    // The list box is titled "branches", so name this section otherwise.
    sections.push({ kind: 'branch', title: 'standalone', rows: plain })
  }
  sections.push({ kind: 'trunk', title: main, rows: [trunk] })
  const undo = await readSnapshot(repo.gitDir)
  return { repo, undo, sections, rows: sections.flatMap((s) => s.rows) }
}
