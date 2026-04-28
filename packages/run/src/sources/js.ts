import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { detectPackageManager, runScriptCommand } from 'nypm'
import { findUp } from '#src/utils/findUp'
import type { DiscoveryResult, ScriptEntry, SourceId } from './index'

export async function discoverJs(cwd: string): Promise<DiscoveryResult> {
  const pkgPath = findUp(['package.json'], cwd)
  if (!pkgPath) return { scripts: [], warnings: [] }

  let pkg: { scripts?: Record<string, string> }
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return { scripts: [], warnings: [`Could not parse ${pkgPath}`] }
  }

  const scriptsObj = pkg.scripts ?? {}
  const names = Object.keys(scriptsObj)
  if (names.length === 0) return { scripts: [], warnings: [] }

  const dir = dirname(pkgPath)
  const detected = await detectPackageManager(dir)
  const pm = (detected?.name ?? 'npm') as SourceId

  const scripts: ScriptEntry[] = names.map((name) => ({
    source: pm,
    name,
    command: runScriptCommand(detected?.name ?? 'npm', name).split(' '),
    cwd: dir,
    description: scriptsObj[name],
  }))

  return { scripts, warnings: [] }
}
