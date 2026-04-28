import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DiscoveryResult, ScriptEntry } from './index'

export function discoverMake(rootDir: string): DiscoveryResult {
  const file = ['Makefile', 'makefile', 'GNUmakefile']
    .map((name) => join(rootDir, name))
    .find((p) => existsSync(p))
  if (!file) return { scripts: [], warnings: [] }

  const dir = rootDir
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  const targets = new Set<string>()
  const descriptions = new Map<string, string>()
  const targetLine = /^([A-Za-z0-9_][A-Za-z0-9_.-]*)\s*:(?!=)/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!line || line.startsWith('\t') || line.startsWith(' ')) continue
    const m = line.match(targetLine)
    if (!m) continue
    const name = m[1]!
    if (name === '.PHONY' || name.includes('%')) continue
    targets.add(name)
    const next = lines[i + 1]
    if (next && next.startsWith('\t')) {
      descriptions.set(name, next.trim())
    }
  }

  const scripts: ScriptEntry[] = [...targets].map((name) => ({
    source: 'make',
    name,
    command: ['make', name],
    cwd: dir,
    description: descriptions.get(name),
  }))

  return { scripts, warnings: [] }
}
