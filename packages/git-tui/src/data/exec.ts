import { execa, type Options } from 'execa'

// Read-only git commands must not take the index lock. Otherwise `git status`
// writes the index, the watcher sees the change, and the TUI reloads again.
export const READ_ONLY_ENV = { GIT_OPTIONAL_LOCKS: '0' }

export class CommandError extends Error {}

// Get the useful line from a failed command: the first "error:", "fatal:" or
// "✗" line. When there is no such line, use the last line of the output.
function errorLine(error: any): string {
  const lines = `${error.stderr ?? ''}\n${error.stdout ?? ''}`
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const marked = lines.find((l) => /^(error:|fatal:|✗)/.test(l))
  const line = marked ?? lines.at(-1) ?? error.shortMessage ?? error.message
  return line.replace(/^(error:|fatal:|✗)\s*/, '')
}

// Run a command and return its stdout as it is, without the last newline.
// On failure, throw a CommandError with one short line that the status bar
// can show.
async function runRaw(
  file: string,
  args: string[],
  options: Options = {},
): Promise<string> {
  try {
    const { stdout } = await execa(file, args, options)
    return String(stdout)
  } catch (error) {
    throw new CommandError(errorLine(error), { cause: error })
  }
}

// Run a command and return its stdout, trimmed.
export async function run(
  file: string,
  args: string[],
  options: Options = {},
): Promise<string> {
  return (await runRaw(file, args, options)).trim()
}

// Run a read-only git command.
export function git(args: string[]): Promise<string> {
  return run('git', args, { env: READ_ONLY_ENV })
}

// Run a read-only git command, and return its lines. The spaces at the
// start of the lines stay: in `git status --short`, they are a column.
export async function gitLines(args: string[]): Promise<string[]> {
  const out = await runRaw('git', args, { env: READ_ONLY_ENV })
  return out.split('\n').filter(Boolean)
}

// Run a git command that can fail as part of a normal check. Returns null on
// failure.
export async function gitOrNull(args: string[]): Promise<string | null> {
  try {
    return await git(args)
  } catch {
    return null
  }
}

export function gh(args: string[]): Promise<string> {
  return run('gh', args)
}
