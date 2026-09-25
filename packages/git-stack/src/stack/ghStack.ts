import { execa } from 'execa'
import { gitDir } from '#src/utils/git'

// The lowest gh-stack version this package is tested with.
export const MIN_GH_STACK_VERSION = '0.1.1'

// The highest schema version of `.git/gh-stack` this package can read.
const SUPPORTED_SCHEMA_VERSION = 1

// The name of the file that gh-stack keeps in the git directory. It also
// writes `gh-stack-rebase-state` there while a rebase stops on a conflict.
export const STACK_FILE = 'gh-stack'
export const REBASE_STATE_FILE = 'gh-stack-rebase-state'

// The on-disk format of `.git/gh-stack`. gh-stack does not document this
// format, so we read only the fields that we need.
export type GhBranchRef = {
  branch: string
  head?: string
  // For a stacked branch: the tip of its parent at the last sync or rebase.
  base?: string
  pullRequest?: { number: number; url?: string; merged?: boolean }
}

export type GhStack = {
  id?: string
  number?: number
  trunk: GhBranchRef
  branches: GhBranchRef[]
}

type GhStackFile = {
  schemaVersion: number
  stacks: GhStack[]
}

export class GhStackError extends Error {}

export class PushFailedError extends GhStackError {
  constructor() {
    super('the push failed, the branches need a force push')
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// Make sure that the gh-stack extension is installed. Returns a warning when
// the version is older than the tested version, otherwise null.
export async function checkGhStack(): Promise<string | null> {
  let stdout: string
  try {
    ;({ stdout } = await execa('gh', ['stack', '--version']))
  } catch {
    throw new GhStackError(
      'gh-stack is not installed. Run: gh extension install github/gh-stack',
    )
  }
  const version = stdout.match(/(\d+\.\d+\.\d+)/)?.[1]
  if (!version) return null
  if (compareVersions(version, MIN_GH_STACK_VERSION) < 0) {
    return `gh-stack ${version} is older than ${MIN_GH_STACK_VERSION}. Run: gh extension upgrade gh-stack`
  }
  return null
}

// Read all the local stacks from `.git/gh-stack`. Returns an empty list when
// the file does not exist.
export async function readStacks(dir?: string): Promise<GhStack[]> {
  const file = Bun.file(`${dir ?? (await gitDir())}/${STACK_FILE}`)
  if (!(await file.exists())) return []
  const data = (await file.json()) as GhStackFile
  if (data.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    throw new GhStackError(
      `.git/${STACK_FILE} has schema version ${data.schemaVersion}. This tool reads only up to version ${SUPPORTED_SCHEMA_VERSION}.`,
    )
  }
  return data.stacks ?? []
}

export async function isRebaseInProgress(dir?: string): Promise<boolean> {
  return Bun.file(`${dir ?? (await gitDir())}/${REBASE_STATE_FILE}`).exists()
}

// Run a gh stack command without a terminal. gh-stack then does not show its
// own prompts. Returns the result message.
export async function ghStack(args: string[]): Promise<string> {
  let output: string
  try {
    const { stdout, stderr } = await execa('gh', ['stack', ...args])
    output = `${stdout}\n${stderr}`
  } catch (error: any) {
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`
    throw new GhStackError(errorLine(output) || error.message)
  }
  // gh stack sync does not force-push. After a rebase, its push fails, but
  // it prints only a warning and ends with a success line.
  if (/Push failed/.test(output)) throw new PushFailedError()
  return successLine(output)
}

function cleanLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^[✓✗!•\s]+/, '').trim())
    .filter(Boolean)
}

function lastLine(text: string): string {
  return cleanLines(text).at(-1) ?? ''
}

// gh-stack marks a result with "✓". Use the last marked line, because the
// other lines are usually progress or advice.
function successLine(text: string): string {
  const marked = text
    .split('\n')
    .filter((l) => l.trim().startsWith('✓'))
    .at(-1)
  return marked ? (cleanLines(marked)[0] ?? '') : lastLine(text)
}

// gh-stack marks an error with "✗". Use the first marked line, because the
// lines after it are usually advice.
function errorLine(text: string): string {
  const marked = text.split('\n').find((l) => l.trim().startsWith('✗'))
  return marked ? (cleanLines(marked)[0] ?? '') : lastLine(text)
}
