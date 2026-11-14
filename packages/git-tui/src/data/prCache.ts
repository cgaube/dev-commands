// Keep the last PR data on disk. At the next start, the TUI shows it at once,
// and then reads the new data from GitHub in the background.

import { readFileSync, statSync } from 'fs'
import type { Pr } from './github'

// The file is in the shared git directory, so that all the worktrees of a
// repository use it.
const FILE = 'git-tui-prs.json'

export type PrCache = {
  data: Record<string, Pr>
  // The time of the last write, in milliseconds.
  updatedAt: number
}

// Read synchronously: TanStack Query needs the initial data at once.
export function readPrCache(commonDir: string): PrCache | null {
  const path = `${commonDir}/${FILE}`
  try {
    return {
      data: JSON.parse(readFileSync(path, 'utf8')),
      updatedAt: statSync(path).mtimeMs,
    }
  } catch {
    // No cache yet, or a bad file.
    return null
  }
}

export async function writePrCache(
  commonDir: string,
  data: Record<string, Pr>,
): Promise<void> {
  // Keep the PRs of branches that are not in this read, for example after a
  // branch was deleted and made again.
  const old = readPrCache(commonDir)?.data ?? {}
  await Bun.write(`${commonDir}/${FILE}`, JSON.stringify({ ...old, ...data }))
}
