import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, parse } from 'node:path'

function isAtBoundary(current: string, root: string, home: string): boolean {
  return current === root || current === home
}

export function findUp(filenames: string[], fromDir: string): string | null {
  const { root } = parse(fromDir)
  const home = homedir()
  let current = fromDir
  while (true) {
    for (const name of filenames) {
      const candidate = join(current, name)
      if (existsSync(candidate)) return candidate
    }
    if (isAtBoundary(current, root, home)) return null
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}
