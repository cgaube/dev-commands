import { discoverJs } from './js'
import { discoverMake } from './make'
import { discoverJust } from './just'
import { discoverTask } from './task'

export type SourceId =
  | 'bun'
  | 'pnpm'
  | 'yarn'
  | 'npm'
  | 'make'
  | 'just'
  | 'task'

export type ScriptEntry = {
  source: SourceId
  name: string
  command: string[]
  cwd: string
  description?: string
}

export type DiscoveryResult = {
  scripts: ScriptEntry[]
  warnings: string[]
}

const SOURCE_ORDER: SourceId[] = [
  'bun',
  'pnpm',
  'yarn',
  'npm',
  'make',
  'just',
  'task',
]

export async function discoverScripts(cwd: string): Promise<DiscoveryResult> {
  const scripts: ScriptEntry[] = []
  const warnings: string[] = []

  const results = await Promise.all([
    discoverJs(cwd),
    discoverMake(cwd),
    discoverJust(cwd),
    discoverTask(cwd),
  ])

  for (const r of results) {
    scripts.push(...r.scripts)
    warnings.push(...r.warnings)
  }

  scripts.sort((a, b) => {
    const sa = SOURCE_ORDER.indexOf(a.source)
    const sb = SOURCE_ORDER.indexOf(b.source)
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name)
  })

  return { scripts, warnings }
}
