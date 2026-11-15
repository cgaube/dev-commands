// The items of the branch list, in the order that it shows them: branch
// rows, and folds. A fold is one line for two or more merged branches of a
// stack, which need no more work. The user can open a fold.

import type { Row, Section } from '#src/data/model'
import type { PrMap } from './query'

export type Fold = {
  // The key of the fold, also the key of its stack. See stackKey.
  key: string
  rows: Row[]
}

export type Item =
  | { type: 'row'; row: Row; key: string }
  | { type: 'fold'; fold: Fold; key: string }

// A fold has at least this number of branches. One merged branch takes one
// line anyway.
const MIN_FOLD = 2

export function isMerged(row: Row, prs: PrMap | undefined): boolean {
  return row.merged || prs?.[row.name]?.status === 'merged'
}

// The key of a stack: its first branch. It does not change when the stack
// gets more branches.
export function stackKey(row: Row): string {
  return row.stack?.branches[0] ?? row.name
}

export function foldKey(key: string): string {
  return `fold:${key}`
}

// The items of one section. In a stack that is not open, each run of merged
// branches becomes one fold.
export function sectionItems(
  section: Section,
  prs: PrMap | undefined,
  open: Set<string>,
): Item[] {
  const items: Item[] = []
  const rowItem = (row: Row): Item => ({ type: 'row', row, key: row.name })
  const first = section.rows[0]
  if (section.kind !== 'stack' || !first || open.has(stackKey(first))) {
    return section.rows.map(rowItem)
  }
  let run: Row[] = []
  const flush = () => {
    if (run.length >= MIN_FOLD) {
      const fold = { key: stackKey(run[0]), rows: run }
      items.push({ type: 'fold', fold, key: foldKey(fold.key) })
    } else {
      items.push(...run.map(rowItem))
    }
    run = []
  }
  for (const row of section.rows) {
    if (isMerged(row, prs)) {
      run.push(row)
    } else {
      flush()
      items.push(rowItem(row))
    }
  }
  flush()
  return items
}

// Keep the branches whose name has all the words of the query, in any
// case. The sections without a branch go away.
export function filterSections(sections: Section[], query: string): Section[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return sections
  return sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) =>
        words.every((word) => row.name.toLowerCase().includes(word)),
      ),
    }))
    .filter((section) => section.rows.length)
}

// All the items of the list, in order. The keyboard moves through them.
export function listItems(
  sections: Section[],
  prs: PrMap | undefined,
  open: Set<string>,
): Item[] {
  return sections.flatMap((s) => sectionItems(s, prs, open))
}

// True when a stack has merged branches that still exist locally. Then
// `gh stack sync --prune` has work to do: it deletes them, and rebases the
// branches above them.
export function needsSync(section: Section, prs: PrMap | undefined): boolean {
  return (
    section.kind === 'stack' &&
    section.rows.some((r) => r.exists && isMerged(r, prs))
  )
}
