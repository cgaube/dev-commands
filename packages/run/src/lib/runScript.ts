import { outro, cancel, isCancel, log, select } from '@clack/prompts'
import {
  introTitle,
  exitWithError,
  exitWithCancel,
  colors,
} from '#common/style'
import { taskLogCommand } from '#common/commands'
import { discoverScripts } from '#src/sources'
import type { ScriptEntry, SourceId } from '#src/sources'

const KNOWN_SOURCES: ReadonlySet<SourceId> = new Set<SourceId>([
  'bun',
  'pnpm',
  'yarn',
  'npm',
  'make',
  'just',
  'task',
])

function formatLabel(entry: ScriptEntry): string {
  const head = colors.cyan(`${entry.source}:`) + ' ' + entry.name
  if (!entry.description) return head
  const trimmed = entry.description.replace(/\s+/g, ' ').trim()
  const max = 60
  const desc = trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed
  return `${head}  ${colors.dim('— ' + desc)}`
}

async function pickFromList(entries: ScriptEntry[], message: string) {
  return select<ScriptEntry>({
    message,
    options: entries.map((e) => ({ value: e, label: formatLabel(e) })),
  })
}

function parseNameArg(raw: string): { source?: SourceId; name: string } {
  const idx = raw.indexOf(':')
  if (idx === -1) return { name: raw }
  const prefix = raw.slice(0, idx)
  if (!KNOWN_SOURCES.has(prefix as SourceId)) return { name: raw }
  return { source: prefix as SourceId, name: raw.slice(idx + 1) }
}

async function runEntry(entry: ScriptEntry, forwardedArgs: string[]) {
  const args = [...entry.command.slice(1), ...forwardedArgs]
  await taskLogCommand(entry.command[0]!, args, {})
}

export async function runScript(
  name: string | undefined,
  scriptArgs: string[],
  options: { source?: SourceId },
) {
  introTitle('Run')

  const { scripts, warnings } = await discoverScripts(process.cwd())
  for (const w of warnings) log.warn(w)

  if (scripts.length === 0) {
    return exitWithCancel('No scripts found in this directory.')
  }

  if (!name) {
    const choice = await pickFromList(scripts, 'Pick a script to run')
    if (isCancel(choice)) return cancel('Operation cancelled.')
    await runEntry(choice, [])
    outro()
    return
  }

  const parsed = parseNameArg(name)
  const source = options.source ?? parsed.source
  const matches = scripts.filter(
    (s) => s.name === parsed.name && (!source || s.source === source),
  )

  if (matches.length === 0) {
    return exitWithError(
      `No script "${parsed.name}"${source ? ` in source "${source}"` : ''} found.`,
    )
  }

  let entry: ScriptEntry
  if (matches.length === 1) {
    entry = matches[0]!
  } else if (process.stdin.isTTY) {
    const choice = await pickFromList(
      matches,
      `Multiple scripts named "${parsed.name}". Pick one`,
    )
    if (isCancel(choice)) return cancel('Operation cancelled.')
    entry = choice
  } else {
    const list = matches.map((m) => `${m.source}:${m.name}`).join(', ')
    return exitWithError(
      `Ambiguous script "${parsed.name}". Candidates: ${list}. Use --source or source:name.`,
    )
  }

  await runEntry(entry, scriptArgs)
  outro()
}
