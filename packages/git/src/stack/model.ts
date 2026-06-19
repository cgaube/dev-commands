import { gitOutput, resolveSha } from '#src/utils/git'

// One tracked branch's place in a stack: which branch it is stacked on and the
// parent's tip sha at the moment we branched / last restacked. The recorded sha
// is what lets restacks replay only this branch's own commits (`rebase --onto`),
// even when the parent was squash-merged into trunk.
export type StackBranch = {
  parent: string
  parentSha: string
}

export type StackMeta = {
  version: 1
  trunk: string
  branches: Record<string, StackBranch>
}

const META_VERSION = 1 as const

// All stack metadata lives in a single JSON document inside the repo's git dir
// (`.git/devstack.json`). It is one read at startup and one write per mutation —
// cheap, atomic enough for a single user, and never committed because anything
// under `.git/` is outside the working tree.
async function metaPath(): Promise<string> {
  const gitDir = (await gitOutput(['rev-parse', '--absolute-git-dir'])).trim()
  return `${gitDir}/devstack.json`
}

// Best-effort trunk detection: the branch new work is ultimately stacked on.
// Prefer the remote's default branch, then a local main/master, falling back to
// "main" so a brand-new repo still has a sensible root.
export async function detectTrunk(): Promise<string> {
  const originHead = await resolveSha('origin/HEAD')
  if (originHead) {
    try {
      const ref = (
        await gitOutput(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
      ).trim()
      const short = ref.replace(/^origin\//, '')
      if (short) return short
    } catch {
      // origin/HEAD not a symbolic ref; fall through to local detection
    }
  }

  for (const candidate of ['main', 'master']) {
    if (await resolveSha(`refs/heads/${candidate}`)) return candidate
  }
  return 'main'
}

export async function readMeta(): Promise<StackMeta> {
  const file = Bun.file(await metaPath())
  if (await file.exists()) {
    const data = (await file.json()) as StackMeta
    // Tolerate a hand-edited or older file by filling in defaults.
    return {
      version: META_VERSION,
      trunk: data.trunk || (await detectTrunk()),
      branches: data.branches ?? {},
    }
  }
  return { version: META_VERSION, trunk: await detectTrunk(), branches: {} }
}

export async function writeMeta(meta: StackMeta): Promise<void> {
  await Bun.write(await metaPath(), `${JSON.stringify(meta, null, 2)}\n`)
}

// Record (or update) a branch's parent and the parent's current tip sha.
export async function setParent(
  branch: string,
  parent: string,
  parentSha: string,
): Promise<StackMeta> {
  const meta = await readMeta()
  meta.branches[branch] = { parent, parentSha }
  await writeMeta(meta)
  return meta
}

// Start tracking `branch`, recording its parent's tip sha automatically.
export async function track(
  branch: string,
  parent: string,
): Promise<StackMeta> {
  const sha = await resolveSha(parent)
  if (!sha)
    throw new Error(`Cannot track ${branch}: parent ${parent} not found`)
  return setParent(branch, parent, sha)
}

export async function untrack(branch: string): Promise<StackMeta> {
  const meta = await readMeta()
  delete meta.branches[branch]
  await writeMeta(meta)
  return meta
}

export function getBranch(
  meta: StackMeta,
  branch: string,
): StackBranch | undefined {
  return meta.branches[branch]
}
