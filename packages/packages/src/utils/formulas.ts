import { execaSync } from 'execa'
import { Glob } from 'bun'
import { readFileSync } from 'fs'
import { basename } from 'path'

type FormulaDesc = {
  desc: string | null
  installed: boolean
}

export function getFormulas() {
  // Get all .rb files in the tap folder
  const repoPath = execaSync('brew', [
    '--repository',
    'cgaube/devcommands',
  ]).stdout.trim()
  const glob = new Glob(`${repoPath}/devcommand-*.rb`)

  const formulas = new Map<string, FormulaDesc>()

  // Check the one that is installed
  const output = execaSync('brew', ['list', '--formula']).stdout.trim()
  const installed = output
    .split(/\s+/)
    .filter(Boolean)
    .filter((f) => f.startsWith('devcommand-'))

  for (const file of glob.scanSync('.')) {
    const content = readFileSync(file, 'utf-8')
    const formulaName = basename(file, '.rb')
    const match = content.match(/desc\s*["'](.*?)["']/s)
    const desc = match ? match[1].trim() : null

    formulas.set(formulaName, {
      desc,
      installed: installed.includes(formulaName),
    })
  }

  return formulas
}
