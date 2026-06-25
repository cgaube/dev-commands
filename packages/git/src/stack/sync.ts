import { resolveSha } from '#src/utils/git'
import { readMeta, writeMeta } from './model'
import { restack, stackOrder, type RestackResult } from './restack'

export type SyncResult = {
  merged: string[]
  restack: RestackResult
}

// Reconcile the stack with reality: find tracked branches whose local ref no
// longer exists (deleted after merge), re-parent their children, drop them from
// metadata, then restack the survivors.
export async function sync(): Promise<SyncResult> {
  const meta = await readMeta()
  const merged: string[] = []

  for (const name of stackOrder(meta)) {
    if (!meta.branches[name]) continue
    if (await resolveSha(name)) continue

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
