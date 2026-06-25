import { gitOutput } from '#src/utils/git'
import { readMeta, type StackMeta } from './model'

export type StackNode = {
  name: string
  parent: string | null
  children: StackNode[]
  ahead: number
  isCurrent: boolean
  isTrunk: boolean
  isDirty: boolean
  exists: boolean
  diverged: boolean
}

export type FlatNode = { node: StackNode; depth: number }

async function isWorkingTreeDirty(): Promise<boolean> {
  const out = await gitOutput(['status', '--porcelain'])
  return out.split(/\r?\n/).some((l) => l.trim().length > 0)
}

async function commitCount(base: string, branch: string): Promise<number> {
  try {
    const out = (
      await gitOutput(['rev-list', '--count', `${base}..${branch}`])
    ).trim()
    return Number(out) || 0
  } catch {
    return 0
  }
}

// Name of the branch HEAD points at. Async (unlike the shared getCurrentBranch,
// which spawns synchronously and would block the event loop on every reload).
async function currentBranch(): Promise<string> {
  return (await gitOutput(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
}

async function refShas(pattern: string): Promise<Map<string, string>> {
  const out = await gitOutput([
    'for-each-ref',
    '--format=%(refname:short) %(objectname)',
    pattern,
  ])
  const shas = new Map<string, string>()
  for (const line of out.split('\n')) {
    const sep = line.indexOf(' ')
    if (sep === -1) continue
    shas.set(line.slice(0, sep), line.slice(sep + 1))
  }
  return shas
}

async function branchShas(): Promise<{
  local: Map<string, string>
  remote: Map<string, string>
}> {
  const [local, rawRemote] = await Promise.all([
    refShas('refs/heads'),
    refShas('refs/remotes/origin'),
  ])
  const remote = new Map<string, string>()
  for (const [ref, sha] of rawRemote) {
    const name = ref.replace(/^origin\//, '')
    remote.set(name, sha)
  }
  return { local, remote }
}

export async function buildForest(
  meta?: StackMeta,
): Promise<{ root: StackNode; meta: StackMeta }> {
  const data = meta ?? (await readMeta())
  const tracked = new Set(Object.keys(data.branches))

  const [current, dirty, { local: shas, remote }] = await Promise.all([
    currentBranch(),
    isWorkingTreeDirty(),
    branchShas(),
  ])

  const root: StackNode = {
    name: data.trunk,
    parent: null,
    children: [],
    ahead: 0,
    isCurrent: current === data.trunk,
    isTrunk: true,
    isDirty: current === data.trunk && dirty,
    exists: shas.has(data.trunk),
    diverged: false,
  }

  const nodes = new Map<string, StackNode>([[data.trunk, root]])

  // Create a node per tracked branch (in parallel), then wire up parent/child
  // links once every node exists.
  await Promise.all(
    Object.keys(data.branches).map(async (name) => {
      const exists = shas.has(name)
      const { parent, parentSha } = data.branches[name]
      const base = shas.has(parent) ? parent : parentSha
      const ahead = exists ? await commitCount(base, name) : 0
      const remoteSha = remote.get(name)
      const localSha = shas.get(name)
      const diverged = !!(localSha && remoteSha && localSha !== remoteSha)

      nodes.set(name, {
        name,
        parent,
        children: [],
        ahead,
        isCurrent: current === name,
        isTrunk: false,
        isDirty: current === name && dirty,
        exists,
        diverged,
      })
    }),
  )

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
