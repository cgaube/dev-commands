import { gitOutput, resolveSha } from '#src/utils/git'
import { getCurrentBranch } from '#src/utils/branches'
import { readMeta, type StackMeta } from './model'
import { isMerged } from './sync'

export type StackNode = {
  name: string
  parent: string | null
  children: StackNode[]
  ahead: number
  behind: number
  isCurrent: boolean
  isTrunk: boolean
  isMerged: boolean
  exists: boolean
}

export type FlatNode = { node: StackNode; depth: number }

// Commits the branch has that its base doesn't (ahead) and vice-versa (behind).
// `git rev-list --left-right --count base...branch` prints "behind<TAB>ahead".
async function aheadBehind(
  base: string,
  branch: string,
): Promise<{ ahead: number; behind: number }> {
  try {
    const out = (
      await gitOutput([
        'rev-list',
        '--left-right',
        '--count',
        `${base}...${branch}`,
      ])
    ).trim()
    const [behind, ahead] = out.split(/\s+/).map((n) => Number(n) || 0)
    return { ahead, behind }
  } catch {
    return { ahead: 0, behind: 0 }
  }
}

// Build the stack forest rooted at trunk. Every tracked branch becomes a node;
// branches whose parent isn't tracked hang directly under trunk so nothing is
// hidden (e.g. an orphan left after its parent was pruned).
export async function buildForest(
  meta?: StackMeta,
): Promise<{ root: StackNode; meta: StackMeta }> {
  const data = meta ?? (await readMeta())
  const current = getCurrentBranch()
  const tracked = new Set(Object.keys(data.branches))

  const root: StackNode = {
    name: data.trunk,
    parent: null,
    children: [],
    ahead: 0,
    behind: 0,
    isCurrent: current === data.trunk,
    isTrunk: true,
    isMerged: false,
    exists: (await resolveSha(data.trunk)) !== null,
  }

  const nodes = new Map<string, StackNode>([[data.trunk, root]])

  // Create a node per tracked branch first, then wire up parent/child links.
  for (const name of Object.keys(data.branches)) {
    const exists = (await resolveSha(name)) !== null
    const { parent } = data.branches[name]
    const base = (await resolveSha(parent))
      ? parent
      : data.branches[name].parentSha
    const { ahead, behind } = exists
      ? await aheadBehind(base, name)
      : { ahead: 0, behind: 0 }

    nodes.set(name, {
      name,
      parent,
      children: [],
      ahead,
      behind,
      isCurrent: current === name,
      isTrunk: false,
      isMerged: exists ? await isMerged(name, data.trunk) : true,
      exists,
    })
  }

  for (const name of Object.keys(data.branches)) {
    const node = nodes.get(name)!
    const parent = data.branches[name].parent
    const parentNode = tracked.has(parent) ? nodes.get(parent)! : root
    parentNode.children.push(node)
  }

  // Stable, readable ordering: children alphabetically within each parent.
  for (const node of nodes.values()) {
    node.children.sort((a, b) => a.name.localeCompare(b.name))
  }

  return { root, meta: data }
}

// Depth-first, depth-annotated flattening for rendering and arrow-key nav.
export function flatten(root: StackNode): FlatNode[] {
  const out: FlatNode[] = []
  const visit = (node: StackNode, depth: number) => {
    out.push({ node, depth })
    for (const child of node.children) visit(child, depth + 1)
  }
  visit(root, 0)
  return out
}
