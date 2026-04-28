import { dirname } from 'node:path'
import { execa } from 'execa'
import { findUp } from '#src/utils/findUp'
import type { DiscoveryResult, ScriptEntry } from './index'

type JustRecipe = {
  name: string
  doc: string | null
  private: boolean
}

type JustDump = {
  recipes: Record<string, JustRecipe>
}

export async function discoverJust(cwd: string): Promise<DiscoveryResult> {
  const file = findUp(['justfile'], cwd)
  if (!file) return { scripts: [], warnings: [] }

  if (!Bun.which('just')) {
    return {
      scripts: [],
      warnings: [`Found ${file} but "just" is not installed; skipping.`],
    }
  }

  const dir = dirname(file)

  let dump: JustDump
  try {
    const { stdout } = await execa('just', [
      '--justfile',
      file,
      '--dump',
      '--dump-format',
      'json',
    ])
    dump = JSON.parse(stdout)
  } catch {
    return {
      scripts: [],
      warnings: [`Could not read recipes from ${file}.`],
    }
  }

  const scripts: ScriptEntry[] = Object.values(dump.recipes)
    .filter((r) => !r.private)
    .map((r) => ({
      source: 'just',
      name: r.name,
      command: ['just', r.name],
      cwd: dir,
      description: r.doc ?? undefined,
    }))

  return { scripts, warnings: [] }
}
